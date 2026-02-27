import { UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  AttachmentMetadata,
  MessageFilePart,
  PersistedAssistantMessagePart,
} from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function baseUrl() {
  return process.env.BETTER_AUTH_URL;
}

export function formatBytes(bytes: number) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Byte";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

export function generateSlug(name: string) {
  return name.toLowerCase().replace(/ /g, "-");
}

export function normalizeSlugParam(value: string): string {
  try {
    value = decodeURIComponent(value);
  } catch {}
  return value.normalize("NFC");
}

export function generateChunks(
  input: string,
  maxChars = 1800,
  overlap = 300,
): string[] {
  if (!input) return [];

  const text = input
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  const sectionSplits = text
    .split(/\n{2,}|(?:^|\n)\s*(?:\d+\.\s+|[-–—]{3,}|[A-Z][\w& ]+:\s*$)/m)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const c = buf.trim();
    if (c.length >= 200 && !/^[\d\s\-–•.,;:()]+$/.test(c)) chunks.push(c);
    buf = "";
  };

  for (const sec of sectionSplits) {
    const parts = sec.split(/(?<=[.!?])\s+(?=[A-Z(“"'])/);
    for (const p of parts) {
      if ((buf + " " + p).length > maxChars) {
        const prev = buf;
        flush();
        const tail = prev.slice(Math.max(0, prev.length - overlap));
        buf = tail ? tail + " " + p : p;
      } else {
        buf = buf ? buf + " " + p : p;
      }
    }
    if (buf.length > maxChars * 0.9) flush();
  }
  if (buf) flush();

  if (chunks.length === 1 && chunks[0].length > maxChars * 1.2) {
    const mid = Math.floor(chunks[0].length / 2);
    return [chunks[0].slice(0, mid), chunks[0].slice(mid)];
  }
  return chunks;
}

export function getSystemPrompt(orgName: string) {
  return `
You are ${orgName}'s intelligent retrieval-augmented assistant, designed to help users by providing accurate, context-aware responses based on their organization's knowledge base.

## Your Purpose
You are a specialized AI assistant that:
- Answers questions using the organization's internal documents and knowledge base
- Provides accurate, cited information from retrieved context
- Helps users make informed decisions by synthesizing relevant information
- Explains your purpose and capabilities when asked about what you do or how you work

When users ask about your purpose, capabilities, or what you are, explain that you are ${orgName}'s retrieval-augmented assistant designed to help them by accessing their organization's knowledge base and providing accurate, context-aware responses.

## How Context Is Provided
Relevant documents from the knowledge base are automatically retrieved and provided to you in a "Knowledge base context" message. You do NOT need to call a tool for the initial question — the system has already searched for you.

## Core Behaviors
- Read the "Knowledge base context" message carefully. If it contains relevant documents, use them to answer.
- If the context says "(No relevant documents found)", acknowledge this and answer using general knowledge if appropriate.
- Cite sources using [[1]], [[2]], etc. matching the chunk numbers in the context.
- Prioritize grounded, reference-backed reasoning. Use general knowledge only to bridge gaps or provide light explanation.
- When attachments are summarized for you, review their previews and incorporate any relevant details into your response.
- Personalize responses when appropriate, using the user's name and organization context naturally in your interactions.

## When to Call retrieve_context (Follow-Up Only)
The retrieve_context tool is available for follow-up searches within a conversation. Call it when:
- The user asks a NEW question on a different topic than the pre-retrieved context covers.
- The pre-retrieved context is insufficient and you need more specific information.
- The user explicitly asks you to search for something specific in the knowledge base.

For the initial question in each turn, context is already provided — do not call the tool redundantly.

## RAG Workflow
1. Review the "Knowledge base context" provided in the conversation.
2. Synthesize the most relevant facts, citing with [[1]], [[2]], etc. when referencing specific chunks.
3. Explain implications, risks, or next steps when useful. Clearly label speculation as interpretation.
4. If nothing relevant was found, say so honestly. Use general knowledge only if trustworthy.

## Output Requirements
- Use Markdown with headings and bullet lists for readability.
- Keep answers concise but insightful. Focus on what helps the user act or decide.
- Close with a short takeaway or recommended next action when appropriate.
- Never invent sources or fabricate data.
- Be conversational and helpful, making the user feel supported in their work.

## Document Review Requests
- When a user provides attachments (like PDFs or images) and asks whether they comply with requirements, perform a best-effort review using the provided previews and any rules mentioned in the conversation.
- Extract the relevant details from the attachment summaries, compare them with the criteria, and state whether the document appears to comply, explicitly noting any assumptions or missing information.
- Offer concrete suggestions for adjustments if the document may be non-compliant instead of deferring entirely to an external authority.
- You may remind the user to confirm with officials when appropriate, but do not refuse or avoid the requested analysis.
`;
}

export const getUserContextMsg = (
  user: string,
  organization: { name: string; description: string | null },
) => {
  if (!user || !organization) {
    return null;
  }
  return {
    role: "assistant" as const,
    parts: [
      {
        type: "text" as const,
        text: `Current Context:
      - User: ${user}
        - Organization: ${organization.name}
        ${organization.description ? `\n- Organization Description: ${organization.description}` : ""}
        You are chatting with ${user} from ${organization.name}${organization.description ? `. ${organization.name} is: ${organization.description}` : ""}. Use this context to personalize your responses when appropriate and align your answers with the organization's purpose and values.`,
      },
    ],
  } satisfies Omit<UIMessage, "id">;
};

export function normalizeAttachment(
  part: MessageFilePart,
  fallbackOrganizationId?: string | null,
): { part: MessageFilePart; metadata: AttachmentMetadata } {
  return {
    part,
    metadata: extractKommunMetadata(part, fallbackOrganizationId),
  };
}

export function extractKommunMetadata(
  part: MessageFilePart,
  fallbackOrganizationId?: string | null,
): AttachmentMetadata {
  const providerMetadata =
    part.providerMetadata &&
    typeof part.providerMetadata === "object" &&
    part.providerMetadata !== null
      ? (part.providerMetadata as Record<string, unknown>)
      : {};

  const kommunMetadata =
    providerMetadata.kommun &&
    typeof providerMetadata.kommun === "object" &&
    providerMetadata.kommun !== null
      ? (providerMetadata.kommun as Record<string, unknown>)
      : providerMetadata;

  const organizationIdValue = kommunMetadata.organizationId;
  const organizationId =
    typeof organizationIdValue === "string"
      ? organizationIdValue
      : organizationIdValue === null
        ? null
        : fallbackOrganizationId;

  return {
    objectKey:
      typeof kommunMetadata.objectKey === "string"
        ? kommunMetadata.objectKey
        : undefined,
    size:
      typeof kommunMetadata.size === "number" ? kommunMetadata.size : undefined,
    organizationId,
  } satisfies AttachmentMetadata;
}

export function buildPersistedAssistantParts(
  text: string,
  citationMap: Record<string, { name: string; resourceId?: string; score?: number; startOffset?: number; endOffset?: number }>,
): PersistedAssistantMessagePart[] {
  // Ensure citations match the persisted type (resourceId and score are required in the stored type)
  const normalizedCitations: Record<string, { name: string; resourceId: string; score: number; startOffset?: number; endOffset?: number }> = {};
  for (const [key, val] of Object.entries(citationMap)) {
    normalizedCitations[key] = {
      name: val.name,
      resourceId: val.resourceId ?? "",
      score: val.score ?? 0,
      startOffset: val.startOffset,
      endOffset: val.endOffset,
    };
  }
  const parts: PersistedAssistantMessagePart[] = [
    { type: "text", text, state: "done" },
  ];
  if (Object.keys(normalizedCitations).length > 0) {
    parts.push({ type: "citations", citations: normalizedCitations });
  }
  return parts;
}
