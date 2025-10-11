import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export const runtime = "nodejs"; // ensure Node (not Edge) for Prisma
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    conversationId,
    messages,
  }: { conversationId: string; messages: UIMessage[] } = await req.json();

  if (!conversationId)
    return new Response("Conversation ID is required", { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const lastMessage = messages[messages.length - 1];

  // Fire-and-forget user message insert (don’t block stream)
  if (lastMessage?.role === "user") {
    const content = lastMessage.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");

    queueMicrotask(() => {
      prisma.message
        .create({
          data: {
            conversationId,
            role: "user",
            content,
            parts: JSON.parse(JSON.stringify(lastMessage.parts)),
          },
        })
        .catch((e) => console.error("user save failed", e));
    });
  }

  // Start streaming immediately
  const result = streamText({
    model: openai("gpt-4.1-nano"),
    messages: convertToModelMessages(messages),

    // Don’t await DB here; schedule it and let the HTTP stream close freely.
    onFinish: (r) => {
      const payload = {
        conversationId,
        role: "assistant" as const,
        content: r.text,
        parts: [{ type: "text", text: r.text, state: "done" }] as const,
      };
      queueMicrotask(() => {
        prisma.message
          .create({
            data: {
              ...payload,
              parts: JSON.parse(JSON.stringify(payload.parts)),
            },
          })
          .catch((e) => console.error("assistant save failed", e));
      });
    },
  });

  // Return the stream now; DB writes continue in background
  return result.toUIMessageStreamResponse();
}
