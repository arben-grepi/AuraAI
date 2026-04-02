import {
  streamText,
  UIMessage,
  convertToModelMessages,
  smoothStream,
  tool,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { generateTitleFromUserMessage } from "@/lib/actions";
import {
  getSystemPrompt,
  getUserContextMsg,
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
import { isSystemAdmin } from "@/lib/auth-utils";
import { withMetrics } from "@/lib/with-metrics";
import { hybridSearch, searchDocuments } from "@/lib/rag/search";
import type { SearchRow } from "@/lib/rag/search";
import { getChatModel, checkOllamaReachable } from "@/lib/ai-provider";

export const runtime = "nodejs";
export const maxDuration = 600;

type ChatRouting =
  | { blocked: false; reason: string }
  | { blocked: true; reason: string };

async function resolveChatProvider(): Promise<ChatRouting> {
  const ollamaUp = await checkOllamaReachable();
  if (ollamaUp) {
    return { blocked: false, reason: "standard" };
  }
  console.warn("[chat] Blocked: Ollama not reachable");
  return {
    blocked: true,
    reason:
      "The on-premise AI model (Ollama) is not reachable. Please make sure Ollama is running and contact your administrator if the problem persists.",
  };
}

type CitationMapEntry = {
  name: string;
  resourceId: string;
  score: number;
  tags?: string[];
};

function getLastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    const parts = Array.isArray(m.parts) ? m.parts : [];
    const text = parts
      .filter(
        (p) => p && typeof p === "object" && "type" in p && p.type === "text",
      )
      .map((p) =>
        "text" in p ? String((p as { text?: unknown }).text ?? "") : "",
      )
      .join("")
      .trim();
    if (text) return text;
  }
  return "";
}

async function handlePost(req: Request) {
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

  const systemPrompt = getSystemPrompt(organizationName?.name ?? "AuraAI");

  if (!isSystemAdmin(session.user.role)) {
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
    select: {
      name: true,
      description: true,
    },
  });

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

  const lastUserText = getLastUserText(messages);
  const citationMap: Record<string, CitationMapEntry> = {};

  let preRetrievalResults: SearchRow[] = [];
  if (lastUserText.trim()) {
    try {
      preRetrievalResults = await hybridSearch(
        lastUserText,
        8,
        organizationId,
      );
      console.log("[chat] Pre-retrieval:", {
        query: lastUserText.slice(0, 200),
        results: preRetrievalResults.length,
        topScore: preRetrievalResults[0]?.score?.toFixed(3) ?? "n/a",
      });
    } catch (e) {
      console.error("[chat] Pre-retrieval failed:", e);
    }
  }

  for (let i = 0; i < preRetrievalResults.length; i++) {
    const row = preRetrievalResults[i];
    citationMap[String(i + 1)] = {
      name: row.resource_name ?? "Document",
      resourceId: row.resource_id,
      score: row.score,
      tags: row.tags ?? undefined,
    };
  }

  const contextText =
    preRetrievalResults.length > 0
      ? preRetrievalResults
        .map(
          (r, i) =>
            `[[${i + 1} | source:${r.resource_name ?? r.resource_id}]]\n${r.content}`,
        )
        .join("\n\n---\n\n")
      : "(No relevant documents found in the knowledge base)";

  const contextMsg = {
    role: "system" as const,
    parts: [
      {
        type: "text" as const,
        text: `Knowledge base context:\n\n${contextText}`,
      },
    ],
  } satisfies Omit<UIMessage, "id">;

  const baseSystem = {
    role: "system" as const,
    parts: [{ type: "text" as const, text: systemPrompt }],
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

  const finalMessages = convertToModelMessages([
    baseSystem,
    contextMsg,
    userContextMsg,
    ...(attachmentsMessage ? [attachmentsMessage] : []),
    ...requestMessages,
  ]);

  const chatProvider = await resolveChatProvider();

  if (chatProvider.blocked) {
    return NextResponse.json(
      { error: chatProvider.reason },
      { status: 503 },
    );
  }

  const chatModel = getChatModel();
  console.log(`[chat] Routing to: ollama (reason: ${chatProvider.reason})`);

  const result = streamText({
    model: chatModel,
    messages: await finalMessages,
    tools: {
      retrieve_context: tool({
        description:
          "Search the organization's knowledge base for additional information. Use this ONLY for follow-up questions on new topics not covered by the pre-retrieved context.",
        inputSchema: z.object({
          userRequest: z
            .string()
            .describe("The follow-up question or topic to search for."),
        }),
        execute: async ({ userRequest }) => {
          const results = await searchDocuments(
            userRequest.trim(),
            6,
            0.5,
            organizationId,
          );
          const baseIndex =
            Math.max(0, ...Object.keys(citationMap).map(Number)) + 1;
          results.forEach((row, i) => {
            const idx = String(baseIndex + i);
            citationMap[idx] = {
              name: row.resource_name ?? "Document",
              resourceId: row.resource_id,
              score: row.score,
              tags: row.tags ?? undefined,
            };
          });
          if (results.length === 0) {
            return "(No relevant documents found for this follow-up search.)";
          }
          return results
            .map(
              (r, i) =>
                `[[${baseIndex + i} | source:${r.resource_name ?? r.resource_id}]]\n${r.content}`,
            )
            .join("\n\n---\n\n");
        },
      }),
    },
    stopWhen: stepCountIs(5),
    experimental_transform: smoothStream({ chunking: "word" }),
    onFinish: (r) => {
      if (isAnonymous === true) return;
      const parts = buildPersistedAssistantParts(r.text, citationMap);
      const persistBody: {
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
        body: JSON.stringify(persistBody),
      }).catch(console.error);
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      // Send citations + active provider on the "finish" event
      if (part.type === "finish") {
        return { citations: citationMap, provider: "ollama" } as Record<string, unknown>;
      }
      return undefined;
    },
  });
}

export const POST = withMetrics(handlePost);
