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
import { retrieveContext } from "@/lib/rag";
import { extractText } from "@/lib/file-extraction";
import { getS3BucketName, getS3Client } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const maxDuration = 30;

const systemPrompt = `
You are Diguro's intelligent retrieval-augmented assistant, designed to help users by providing accurate, context-aware responses based on their organization's knowledge base.

## Your Purpose
You are a specialized AI assistant that:
- Answers questions using the organization's internal documents and knowledge base
- Provides accurate, cited information from retrieved context
- Helps users make informed decisions by synthesizing relevant information
- Explains your purpose and capabilities when asked about what you do or how you work

When users ask about your purpose, capabilities, or what you are, explain that you are Diguro's retrieval-augmented assistant designed to help them by accessing their organization's knowledge base and providing accurate, context-aware responses.

## Core Behaviors
- Always read the "Context documents" message. If it is empty, acknowledge that no internal sources were retrieved before answering.
- Prioritize grounded, reference-backed reasoning. Use general knowledge only to bridge gaps or provide light explanation.
- When attachments are summarized for you, review their previews and incorporate any relevant details into your response.
- Personalize responses when appropriate, using the user's name and organization context naturally in your interactions.

## RAG Workflow
1. Review the latest user request and the retrieved snippets.
2. Synthesize the most relevant facts, citing the snippet markers like [[1]] whenever you reference them.
3. Explain implications, risks, or next steps when useful. Clearly label speculation as interpretation.
4. If nothing relevant was retrieved, say so and rely on general knowledge only if it is trustworthy.

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

type MessageFilePart = Extract<UIMessage["parts"][number], { type: "file" }>;

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

  // Skip conversation and message persistence in anonymous mode
  // Explicitly check that isAnonymous is true (not just truthy) to prevent any accidental creation
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
      const content = lastMessage.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
      prisma.message
        .create({
          data: {
            conversationId,
            role: "user",
            content,
            parts: JSON.parse(JSON.stringify(lastMessage.parts ?? [])),
          },
        })
        .catch((e) => console.error("user save failed", e));
    }
  }

  const latestText =
    messages[messages.length - 1]?.parts
      ?.map((p) => (p.type === "text" ? p.text : ""))
      .join("") ?? "";

  const [user, organization] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, description: true },
    }),
  ]);

  const { context } = await retrieveContext(latestText, 6, organizationId);

  const baseSystem = {
    role: "system" as const,
    parts: [{ type: "text" as const, text: systemPrompt }],
  } satisfies Omit<UIMessage, "id">;

  const userContextMsg = {
    role: "assistant" as const,
    parts: [
      {
        type: "text" as const,
        text: `Current Context:
- User: ${user?.name || "User"}
- Organization: ${organization?.name || "Organization"}${organization?.description ? `\n- Organization Description: ${organization.description}` : ""}

You are chatting with ${user?.name || "the user"} from ${organization?.name || "their organization"}${organization?.description ? `. ${organization.name} is: ${organization.description}` : ""}. Use this context to personalize your responses when appropriate and align your answers with the organization's purpose and values.`,
      },
    ],
  } satisfies Omit<UIMessage, "id">;

  const contextMsg = {
    role: "assistant" as const,
    parts: [
      {
        type: "text" as const,
        text: context
          ? `Context documents (top-k):\n\n${context}\n\nInstruction: cite snippet markers like [[1]] when you reference them and avoid speculation.`
          : "No matching internal documents were retrieved. If you answer, make it clear you are relying on general knowledge.",
      },
    ],
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

  const requestMessages = messages.map(({ id, ...rest }) => rest) as Array<
    Omit<UIMessage, "id">
  >;

  const sanitizedRequestMessages = requestMessages.map((message) => {
    const nonFileParts = message.parts?.filter((part) => part.type !== "file");

    if (nonFileParts && nonFileParts.length > 0) {
      return { ...message, parts: nonFileParts };
    }

    if (message.role === "user") {
      return {
        ...message,
        parts: [
          {
            type: "text" as const,
            text: "[User uploaded attachments for review]",
          },
        ],
      } satisfies Omit<UIMessage, "id">;
    }

    if (message.role === "assistant") {
      return {
        ...message,
        parts: [
          {
            type: "text" as const,
            text: "[Assistant processed attachment metadata]",
          },
        ],
      } satisfies Omit<UIMessage, "id">;
    }

    return {
      ...message,
      parts: [{ type: "text" as const, text: "" }],
    } satisfies Omit<UIMessage, "id">;
  });

  const finalMessages = convertToModelMessages([
    baseSystem,
    userContextMsg,
    contextMsg,
    ...(attachmentsMessage ? [attachmentsMessage] : []),
    ...sanitizedRequestMessages,
  ]);

  const result = streamText({
    model: openai("gpt-4o"),
    messages: finalMessages,
    experimental_transform: smoothStream({ chunking: "word" }),
    onFinish: (r) => {
      // Skip message persistence in anonymous mode - explicitly check for true
      if (isAnonymous === true) {
        return;
      }
      const cookie = req.headers.get("cookie");
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/persist-message`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
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

interface BuildAttachmentContextArgs {
  attachments: NormalizedAttachment[];
  organizationId?: string | null;
}

async function buildAttachmentContext({
  attachments,
  organizationId,
}: BuildAttachmentContextArgs): Promise<Omit<UIMessage, "id">> {
  const summaries: string[] = [];
  for (let index = 0; index < attachments.length; index++) {
    const summary = await summarizeAttachmentWithTimeout(
      attachments[index],
      index,
    );
    summaries.push(summary);
  }

  const header = `Uploaded attachments (active organization: ${
    organizationId ?? "none"
  }):`;

  const body = summaries.join("\n\n");
  const note =
    "\n\nPreviews are truncated for brevity. Reference them when forming your response.";

  return {
    role: "assistant" as const,
    parts: [
      {
        type: "text" as const,
        text: `${header}\n\n${body}${note}`,
      },
    ],
  } satisfies Omit<UIMessage, "id">;
}

async function summarizeAttachmentWithTimeout(
  attachment: NormalizedAttachment,
  index: number,
): Promise<string> {
  const { part, metadata } = attachment;

  const sizeLabel =
    typeof metadata.size === "number"
      ? `${metadata.size} bytes`
      : "unknown size";
  const objectKeyLabel = metadata.objectKey ?? "none";
  const providerOrgLabel =
    metadata.organizationId === null
      ? "null"
      : (metadata.organizationId ?? "unknown");

  const baseLine = `${index + 1}. ${part.filename ?? "attachment"} • ${
    part.mediaType ?? "unknown"
  } • ${sizeLabel} • objectKey:${objectKeyLabel} • organizationId:${providerOrgLabel} • url:${
    part.url ?? "(missing url)"
  }`;

  let preview: string;

  try {
    preview = await withTimeout(
      buildAttachmentPreview(part, metadata.objectKey),
      ATTACHMENT_PREVIEW_TIMEOUT_MS,
      "Preview unavailable: timed out while preparing document preview.",
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    preview = `Preview unavailable: ${reason}`;
  }

  return `${baseLine}\n${preview}`;
}

interface AttachmentMetadata {
  objectKey?: string;
  size?: number;
  organizationId?: string | null;
}

interface NormalizedAttachment {
  part: MessageFilePart;
  metadata: AttachmentMetadata;
}

function normalizeAttachment(
  part: MessageFilePart,
  fallbackOrganizationId?: string | null,
): NormalizedAttachment {
  return {
    part,
    metadata: extractKommunMetadata(part, fallbackOrganizationId),
  } satisfies NormalizedAttachment;
}

function extractKommunMetadata(
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

async function buildAttachmentPreview(
  part: MessageFilePart,
  objectKey?: string,
): Promise<string> {
  if (!part.url) {
    return "Preview unavailable: attachment is missing a download URL.";
  }

  if (!canExtractText(part)) {
    return "Preview unavailable: attachment is not a supported text document.";
  }

  try {
    const file = await downloadAttachment({
      url: part.url,
      fileName: part.filename ?? "attachment",
      mediaType: part.mediaType ?? "application/octet-stream",
      objectKey,
    });

    const text = await extractText(file);
    const normalized = normalizePreviewText(text);

    if (!normalized) {
      return "Preview unavailable: no readable text was extracted from the attachment.";
    }

    return `Preview:\n${truncatePreview(normalized)}`;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return `Preview unavailable: ${reason}`;
  }
}

function canExtractText(part: MessageFilePart): boolean {
  const mediaType = (part.mediaType ?? "").toLowerCase();
  const filename = (part.filename ?? "").toLowerCase();

  return (
    mediaType === "text/plain" ||
    mediaType === "application/pdf" ||
    filename.endsWith(".txt") ||
    filename.endsWith(".pdf")
  );
}

function normalizePreviewText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

const PREVIEW_CHAR_LIMIT = 1200;

const ATTACHMENT_PREVIEW_TIMEOUT_MS = 5000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });

  try {
    return await Promise.race([
      promise
        .then((value) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          return value;
        })
        .catch((error) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          throw error;
        }),
      timeoutPromise,
    ]);
  } finally {
    promise.catch(() => undefined);
  }
}

function truncatePreview(text: string): string {
  if (text.length <= PREVIEW_CHAR_LIMIT) {
    return text;
  }

  return `${text.slice(0, PREVIEW_CHAR_LIMIT)}…`;
}

interface DownloadAttachmentArgs {
  url: string;
  fileName: string;
  mediaType: string;
  objectKey?: string | null;
}

async function downloadAttachment({
  url,
  fileName,
  mediaType,
  objectKey,
}: DownloadAttachmentArgs): Promise<File> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new File([arrayBuffer], fileName, { type: mediaType });
  } catch (httpError) {
    if (!objectKey) {
      throw httpError;
    }

    try {
      const client = getS3Client();
      const bucket = getS3BucketName();
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      );

      const body = object.Body;
      if (!body) {
        throw new Error("Attachment is empty");
      }

      const bytes = await readBody(body);
      // Create a new Uint8Array to ensure it has a proper ArrayBuffer (not SharedArrayBuffer)
      const compatibleBytes = new Uint8Array(bytes);
      return new File([compatibleBytes], fileName, { type: mediaType });
    } catch (s3Error) {
      throw httpError instanceof Error ? httpError : s3Error;
    }
  }
}

async function readBody(body: unknown): Promise<Uint8Array> {
  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray: () => Promise<Uint8Array> })
      .transformToByteArray === "function"
  ) {
    return (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
  }

  if (
    typeof body === "object" &&
    body !== null &&
    Symbol.asyncIterator in (body as Record<symbol, unknown>)
  ) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<
      Buffer | Uint8Array | string
    >) {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      } else {
        chunks.push(Buffer.from(chunk));
      }
    }
    return Buffer.concat(chunks);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "arrayBuffer" in body &&
    typeof (body as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer ===
      "function"
  ) {
    const arrayBuffer = await (
      body as { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  throw new Error("Unsupported attachment stream type");
}
