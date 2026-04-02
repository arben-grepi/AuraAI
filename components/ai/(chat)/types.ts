import type { FileUIPart, TextUIPart, UIMessage } from "ai";

export type CitationInfo = {
  name: string;
  resourceId: string;
  score: number;
  tags?: string[];
};

export type ChatMessage = UIMessage<{
  createdAt?: string;
  citations?: Record<string, CitationInfo>;
  provider?: "openai" | "ollama";
}>;

export type ChatMessagePart = ChatMessage["parts"][number];

export type ChatFilePart = Extract<ChatMessagePart, FileUIPart>;

export type ChatTextPart = Extract<ChatMessagePart, TextUIPart>;

/** Tool invocation part (tool-* or dynamic-tool) for UI display. */
export type ChatToolInvocationPart = ChatMessagePart & {
  type: `tool-${string}` | "dynamic-tool";
  toolCallId: string;
  toolName?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

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
  const rawParts =
    Array.isArray(message.parts) && message.parts.length > 0
      ? message.parts.filter(
          (part): part is Record<string, unknown> =>
            typeof part === "object" && part !== null && "type" in part,
        )
      : [];

  const citationPart = rawParts.find((p) => p.type === "citations");
  const citations =
    citationPart && "citations" in citationPart && citationPart.citations
      ? (citationPart.citations as Record<string, CitationInfo>)
      : undefined;

  const parts = rawParts
    .filter((p) => p.type !== "citations")
    .map((p) => p as ChatMessage["parts"][number]);

  const hasMetadata = message.createdAt || citations;
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    parts: parts.length > 0 ? parts : [{ type: "text", text: message.content }],
    metadata: hasMetadata
      ? {
          ...(message.createdAt ? { createdAt: message.createdAt } : {}),
          ...(citations ? { citations } : {}),
        }
      : undefined,
  } satisfies ChatMessage;
}
