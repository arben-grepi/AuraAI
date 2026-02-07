import {
  streamText,
  UIMessage,
  convertToModelMessages,
  smoothStream,
  tool,
  stepCountIs,
  generateText,
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
import { persistUserMessage } from "@/lib/chat-server";
import type {
  MessageFilePart,
  PersistedAssistantMessagePart,
} from "@/lib/types";
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
    select: { name: true },
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, description: true },
  });

  const baseSystem = {
    role: "system" as const,
    parts: [{ type: "text" as const, text: systemPrompt }],
  } satisfies Omit<UIMessage, "id">;

  if (!user || !organization) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userContextMsg = getUserContextMsg(user.name, {
    name: organization.name,
    description: organization.description ?? null,
  });

  if (!userContextMsg) {
    return NextResponse.json(
      { error: "User context not found" },
      { status: 404 },
    );
  }

  // Initialize empty citationMap - will be populated by retrieve_context tool calls
  const citationMap: Record<string, { name: string }> = {};

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
        description:
          "Retrieve context from the organization's knowledge base. Pass the user's original request or question, and the tool will automatically generate an optimized search query.",
        inputSchema: z.object({
          userRequest: z
            .string()
            .describe(
              "The user's original request or question about what they want to retrieve from the knowledge base. This can be conversational - the tool will automatically optimize it for search.",
            ),
        }),
        execute: async ({ userRequest }) => {
          console.log(
            "[retrieve_context tool] User request received:",
            userRequest,
          );

          // Generate an optimized search query from the user's request
          const chatModel = process.env.OLLAMA_CHAT_MODEL ?? "qwen3";
          const { text: optimizedQuery } = await generateText({
            model: ollama(chatModel),
            system: `You are a query optimization assistant for semantic search. Your task is to create an optimized search query that will effectively find relevant documents.

Your goal is to extract the core topic and create a query that:
1. Focuses on the main subject (person, project, concept, entity)
2. Includes relevant context or related terms if helpful for semantic matching
3. Is optimized for vector similarity search

Examples:
- User: "can you look into your context about Glenfell" -> "Glenfell"
- User: "retrieve context about glenfell its happening again" -> "Glenfell incident"
- User: "what do you know about project X" -> "project X"
- User: "information about the budget proposal" -> "budget proposal"
- User: "tell me about John's report" -> "John report"

Rules:
- Extract the core subject matter (names, projects, concepts)
- Remove conversational phrases ("can you", "look into", "what do you know", "call retrieve_context tool")
- If the user mentions an event or context (like "its happening again"), include that as part of the query
- Keep it focused but descriptive enough for semantic matching (typically 1-4 words)
- Use the exact spelling/capitalization of names when possible`,
            prompt: `User request: "${userRequest}"

Generate an optimized search query for semantic retrieval:`,
            temperature: 0.2,
          });

          console.log(
            "[retrieve_context tool] Optimized query generated:",
            optimizedQuery,
          );

          const { context, results } = await retrieveContext(
            optimizedQuery.trim(),
            6,
            organizationId,
          );
          return {
            context: context
              ? `Context documents (top-k):\n\n${context}\n\nInstruction: cite snippet markers like [[1]] when you reference them and avoid speculation.`
              : "No matching internal documents were retrieved for this organization. If you answer, say you have no information from the organization's knowledge base and rely only on general knowledge. If the user expects their documents (e.g. CV) to be available, suggest they confirm they are in the correct organization and that the file was uploaded to RAG for this org.",
            results: results as {
              resource_name?: string | null;
              resource_id?: string;
            }[],
            citationMap: Object.fromEntries(
              results.map((r, i) => [
                String(i + 1),
                { name: r.resource_name || r.resource_id || "Document" },
              ]),
            ),
          };
        },
      }),
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
