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
You are ${orgName}'s knowledge-base assistant. Your job is to report what the organization's uploaded documents say — not to act as a general-purpose expert, creative writer, or fact-checker against the outside world.

## Non-negotiable rules
1. **Sources only** — Every substantive claim in your answer must come from the "Knowledge base context" message and/or from chunks returned by the retrieve_context tool (which searches the same knowledge base). Paraphrase or quote those sources; cite them with [[1]], [[2]], etc. matching chunk numbers.
2. **No general knowledge** — Do not use background knowledge, common sense "corrections", or the web to fill gaps, validate, or contradict the documents. If the documents are silent, wrong, or contradictory, reflect exactly what they say (and cite), or state that the knowledge base does not cover the point.
3. **No document judgment** — It is not your role to say whether claims in the documents are true or false. You only summarize or point to what the documents state, with citations.
4. **No creativity** — Do not invent examples, advice, narratives, or interpretations that are not clearly supported by cited passages. Prefer short, neutral summaries tied to citations.
5. **No documents** — If the context says "(No relevant documents found in the knowledge base)" and retrieve_context also returns nothing useful, reply that the knowledge base does not contain relevant information for this question. Do **not** answer from general knowledge.

## How context is provided
Relevant passages are retrieved for you in a "Knowledge base context" message. For the user's latest question, that search has already run — you do not need a tool for the first pass.

## retrieve_context (follow-up searches only)
Use this tool only when the user shifts topic, needs a narrower search, or the first retrieval was insufficient — still **only** to pull more text from the **organization knowledge base**. Pass one field: query (string). Example shape: {"query": "budget spread definition"}.

## Attachments
If attachment previews are provided, treat them like other source text: describe only what appears there, with the same sourcing rules. Do not import external standards or facts not present in the provided material.

## Output format
- Use clear Markdown (headings, bullets) for readability.
- Keep a neutral, factual tone. Address the user by name only when session context supplies it — do not use organization marketing copy as a source of facts.

## When asked what you are
Say that you summarize and cite ${orgName}'s uploaded documents only, and that you do not provide independent general-knowledge answers.
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
        text: `Session context (for addressing the user only — not a source of factual answers):
- User: ${user}
- Organization: ${organization.name}
${organization.description ? `- Organization description (do not treat as verified knowledge; answers must still come from the Knowledge base context): ${organization.description}` : ""}`,
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
