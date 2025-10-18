import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  smoothStream,
} from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { generateTitleFromUserMessage } from "@/lib/actions";

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

  const doesExist = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });

  const lastMessage = messages[messages.length - 1] as UIMessage | undefined;

  if (!doesExist && lastMessage) {
    const title = await generateTitleFromUserMessage({
      message: lastMessage,
    });

    await prisma.conversation.create({
      data: {
        id: conversationId,
        userId: session.user.id,
        title,
      },
    });
  }

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

  const result = streamText({
    model: openai("gpt-4.1-nano"),
    messages: convertToModelMessages(messages),
    experimental_transform: smoothStream({ chunking: "word" }),
    onFinish: (r) => {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/persist-message`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          role: "assistant",
          content: r.text,
          parts: [{ type: "text", text: r.text, state: "done" }],
        }),
      }).catch(console.error);
    },
  });

  return result.toUIMessageStreamResponse();
}
