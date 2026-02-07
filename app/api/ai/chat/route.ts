import {
  streamText,
  UIMessage,
  convertToModelMessages,
  smoothStream,
  tool,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { ollama } from "ai-sdk-ollama";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { generateTitleFromUserMessage } from "@/lib/actions";
import { retrieveContext } from "@/lib/rag";
import {
  getSystemPrompt,
  getUserContextMsg,
  sanitizeFilePartsForOllama,
  normalizeAttachment,
  buildPersistedAssistantParts,
} from "@/lib/utils";
import { buildAttachmentContext } from "@/lib/attachments-server";
import {
  getMessageTextContent,
  persistUserMessage,
} from "@/lib/chat-server";
import type { MessageFilePart, PersistedAssistantMessagePart } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const {
    conversationId,
    messages,
    isAnonymous,
  }: { conversationId: string; messages: UIMessage[]; isAnonymous?: boolean } =
    body;

  if (!isAnonymous && (!conversationId || typeof conversationId !== "string")) {
    return new Response("Conversation ID is required", { status: 400 });
  }

  if (!Array.isArray(messages)) {
    return new Response("Messages must be an array", { status: 400 });
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) return new Response("Unauthorized", { status: 401 });

  const organizationId = session.session?.activeOrganizationId;

  if (!organizationId) {
    return new Response("No active organization", { status: 400 });
  }

  const organizationName = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true }
  });

  const systemPrompt = getSystemPrompt(organizationName?.name ?? "Diguro");

  if (session.user.role !== "admin") {
    const membership = await prisma.member.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!membership) {
      return new Response("Unauthorized", { status: 403 });
    }
  }

  const lastMessage = messages[messages.length - 1] as UIMessage | undefined;

  if (isAnonymous !== true) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
        organizationId,
      },
      select: { id: true },
    });

    if (!conversation && lastMessage) {
      const title = await generateTitleFromUserMessage({
        message: lastMessage,
      });
      await prisma.conversation.upsert({
        where: { id: conversationId },
        update: {},
        create: {
          id: conversationId,
          userId: session.user.id,
          organizationId,
          title,
        },
      });
    }

    if (lastMessage?.role === "user") {
      persistUserMessage(conversationId, lastMessage).catch((e) =>
        console.error("user save failed", e),
      );
    }
  }

  const latestText = getMessageTextContent(messages[messages.length - 1]);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  })

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, description: true },
  });

  const { context, results } = await retrieveContext(
    latestText,
    6,
    organizationId,
  );

  const citationMap: Record<string, { name: string }> = Object.fromEntries(
    (results as { resource_name?: string | null; resource_id?: string }[]).map(
      (r, i) => [
        String(i + 1),
        { name: r.resource_name || r.resource_id || "Document" },
      ],
    ),
  );

  const baseSystem = {
    role: "system" as const,
    parts: [{ type: "text" as const, text: systemPrompt }],
  } satisfies Omit<UIMessage, "id">;

  if (!user || !organization) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userContextMsg = getUserContextMsg(user.name, { name: organization.name, description: organization.description ?? null });

  if (!userContextMsg) {
    return NextResponse.json({ error: "User context not found" }, { status: 404 });
  }

  const contextMsg = {
    role: "system" as const,
    parts: [
      {
        type: "text" as const,
        text: context
          ? `Context documents (top-k):\n\n${context}\n\nInstruction: cite snippet markers like [[1]] when you reference them and avoid speculation.`
          : "No matching internal documents were retrieved for this organization. If you answer, say you have no information from the organization's knowledge base and rely only on general knowledge. If the user expects their documents (e.g. CV) to be available, suggest they confirm they are in the correct organization and that the file was uploaded to RAG for this org.",
      },
    ],
  } satisfies Omit<UIMessage, "id">;

  const fileParts = (lastMessage?.parts ?? []).filter(
    (part): part is MessageFilePart => part.type === "file",
  );

  const normalizedAttachments = fileParts.map((part) =>
    normalizeAttachment(part, organizationId),
  );

  const attachmentsMessage = normalizedAttachments.length
    ? await buildAttachmentContext({
      attachments: normalizedAttachments,
      organizationId,
    })
    : null;

  const requestMessages = messages.map(({ ...rest }) => rest) as Array<
    Omit<UIMessage, "id">
  >;

  const messagesForModel = sanitizeFilePartsForOllama(requestMessages);

  const finalMessages = convertToModelMessages([
    baseSystem,
    userContextMsg,
    contextMsg,
    ...(attachmentsMessage ? [attachmentsMessage] : []),
    ...messagesForModel,
  ]);

  const chatModel = process.env.OLLAMA_CHAT_MODEL ?? "qwen3";

  const result = streamText({
    model: ollama(chatModel),
    messages: await finalMessages,
    tools: {
      get_weather: tool({
        description:
          "Get the current weather for a location. Use this when the user asks about weather.",
        inputSchema: z.object({
          location: z
            .string()
            .describe("City or place name, e.g. London, San Francisco"),
        }),
        execute: async ({ location }) => {
          return {
            location,
            temperature: 22,
            unit: "celsius",
            condition: "Sunny",
            humidity: 65,
            wind: "12 km/h NE",
          };
        },
      }),
      webSearch: ollama.tools.webSearch(),
      retrieve_context: tool({
        description: "Retrieve context from the organization's knowledge base.",
        inputSchema: z.object({
          query: z.string().describe("The query to retrieve context for."),
        }),
        execute: async ({ query }) => {
          const { context, results } = await retrieveContext(query, 6, organizationId);
          return {
            context: context ? `Context documents (top-k):\n\n${context}\n\nInstruction: cite snippet markers like [[1]] when you reference them and avoid speculation.` : "No matching internal documents were retrieved for this organization. If you answer, say you have no information from the organization's knowledge base and rely only on general knowledge. If the user expects their documents (e.g. CV) to be available, suggest they confirm they are in the correct organization and that the file was uploaded to RAG for this org.",
            results: results as { resource_name?: string | null; resource_id?: string }[],
            citationMap: Object.fromEntries(
              results.map((r, i) => [
                String(i + 1),
                { name: r.resource_name || r.resource_id || "Document" },
              ]),
            ),
          };
        },
      })
    },
    stopWhen: stepCountIs(5),
    experimental_transform: smoothStream({ chunking: "word" }),
    onFinish: (r) => {
      if (isAnonymous === true) return;
      const parts = buildPersistedAssistantParts(r.text, citationMap);
      const body: {
        conversationId: string;
        role: "assistant";
        content: string;
        parts: PersistedAssistantMessagePart[];
      } = {
        conversationId,
        role: "assistant",
        content: r.text,
        parts,
      };
      const cookie = req.headers.get("cookie");
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/persist-message`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      }).catch(console.error);
    },
  });

  return result.toUIMessageStreamResponse();
}

