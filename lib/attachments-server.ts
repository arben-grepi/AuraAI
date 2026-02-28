import { UIMessage } from "ai";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { extractText } from "./file-extraction";
import { getS3BucketName, getS3Client } from "./s3";
import type { AttachmentMetadata, MessageFilePart } from "./types";

export interface NormalizedAttachment {
  part: MessageFilePart;
  metadata: AttachmentMetadata;
}

export interface BuildAttachmentContextArgs {
  attachments: NormalizedAttachment[];
  organizationId?: string | null;
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
          if (timeoutId) clearTimeout(timeoutId);
          return value;
        })
        .catch((error) => {
          if (timeoutId) clearTimeout(timeoutId);
          throw error;
        }),
      timeoutPromise,
    ]);
  } finally {
    promise.catch(() => undefined);
  }
}

function truncatePreview(text: string): string {
  if (text.length <= PREVIEW_CHAR_LIMIT) return text;
  return `${text.slice(0, PREVIEW_CHAR_LIMIT)}…`;
}

function normalizePreviewText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
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

function isImagePart(part: MessageFilePart): boolean {
  const mediaType = (part.mediaType ?? "").toLowerCase();
  const filename = (part.filename ?? "").toLowerCase();
  return (
    mediaType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i.test(filename)
  );
}

interface DownloadAttachmentArgs {
  url: string;
  fileName: string;
  mediaType: string;
  objectKey?: string | null;
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

async function downloadAttachment({
  url,
  fileName,
  mediaType,
  objectKey,
}: DownloadAttachmentArgs): Promise<File> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return new File([arrayBuffer], fileName, { type: mediaType });
  } catch (httpError) {
    if (!objectKey) throw httpError;
    try {
      const client = getS3Client();
      const bucket = getS3BucketName();
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
      const body = object.Body;
      if (!body) throw new Error("Attachment is empty");
      const bytes = await readBody(body);
      return new File([new Uint8Array(bytes)], fileName, { type: mediaType });
    } catch (s3Error) {
      throw httpError instanceof Error ? httpError : s3Error;
    }
  }
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

export async function summarizeAttachmentWithTimeout(
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
  const baseLine = `${index + 1}. ${part.filename ?? "attachment"} • ${part.mediaType ?? "unknown"} • ${sizeLabel} • objectKey:${objectKeyLabel} • organizationId:${providerOrgLabel} • url:${part.url ?? "(missing url)"}`;
  if (isImagePart(part)) {
    return `${baseLine}\nImage attached; it is included in the user message for the model to process.`;
  }
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

export async function buildAttachmentContext({
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
  const header = `Uploaded attachments (active organization: ${organizationId ?? "none"}):`;
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
