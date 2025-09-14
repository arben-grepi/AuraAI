import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";

export const maxDuration = 30;

export async function POST(req: Request) {
  console.log("Starting route");
  const {
    conversationId,
    messages,
  }: { conversationId: string; messages: UIMessage[] } = await req.json();
  console.log("Conversation ID:", conversationId);

  if (!conversationId) {
    console.log("Conversation ID is required");
    return new Response("Conversation ID is required", { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    console.log("Unauthorized");
    return new Response("Unauthorized", { status: 401 });
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === "user") {
    try {
      await prisma.message.create({
        data: {
          conversationId,
          role: lastMessage.role,
          content: lastMessage.parts
            .map((part) => (part.type === "text" ? part.text : ""))
            .join(""),
          parts: JSON.parse(JSON.stringify(lastMessage.parts)),
        },
      });
      console.log("Created new user message");
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        console.log("Duplicate message detected, continuing...");
      } else {
        throw error;
      }
    }
  }

  console.log("Processed user message");

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
    onFinish: async (result) => {
      console.log("Finished streaming");
      await prisma.message.create({
        data: {
          conversationId,
          role: "assistant",
          content: result.text,
          parts: JSON.parse(
            JSON.stringify([
              {
                type: "text",
                text: result.text,
                state: "done",
              },
            ]),
          ),
        },
      });
      console.log("Created assistant message");
    },
  });

  return result.toUIMessageStreamResponse();
}
