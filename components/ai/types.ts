import type { FileUIPart, TextUIPart, UIMessage } from "ai";

export type ChatMessage = UIMessage<{ createdAt?: string }>;

export type ChatMessagePart = ChatMessage["parts"][number];

export type ChatFilePart = Extract<ChatMessagePart, FileUIPart>;

export type ChatTextPart = Extract<ChatMessagePart, TextUIPart>;

export type UploadedAttachment = {
  id: string;
  name: string;
  url: string;
  mediaType: string;
  size: number;
  objectKey?: string;
  organizationId?: string | null;
};

export type StoredChatMessage = {
  id: string;
  role: string;
  content: string;
  parts?: unknown;
  createdAt?: string;
};

export function toChatMessage(message: StoredChatMessage): ChatMessage {
  const parts =
    Array.isArray(message.parts) && message.parts.length > 0
      ? (message.parts.filter((part) =>
          typeof part === "object" && part !== null && "type" in part,
        ) as ChatMessage["parts"])
      : undefined;

  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    parts: parts && parts.length > 0 ? parts : [{ type: "text", text: message.content }],
    metadata: message.createdAt ? { createdAt: message.createdAt } : undefined,
  } satisfies ChatMessage;
}
