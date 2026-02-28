import { UIMessage } from "ai";
import prisma from "./prisma";

export function getMessageTextContent(message: UIMessage | undefined): string {
  if (!message?.parts?.length) return "";
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
}

export function persistUserMessage(
  conversationId: string,
  message: UIMessage,
): Promise<unknown> {
  const content = getMessageTextContent(message);
  return prisma.message.create({
    data: {
      conversationId,
      role: "user",
      content,
      parts: JSON.parse(JSON.stringify(message.parts ?? [])),
    },
  });
}
