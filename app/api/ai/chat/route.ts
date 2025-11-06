// app/api/ai/chat/route.ts
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  smoothStream,
  tool,
  zodSchema,
} from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { generateTitleFromUserMessage } from "@/lib/actions";
import { retrieveContext } from "@/lib/rag";
import { ingestFileToRag } from "@/lib/rag-ingest";
import { z } from "zod";
import { getS3BucketName, getS3Client } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const maxDuration = 30;

const systemPrompt = `
You are Kommun's retrieval-augmented assistant.

## Core Behaviors
- Always read the "Context documents" message. If it is empty, acknowledge that no internal sources were retrieved before answering.
- Prioritize grounded, reference-backed reasoning. Use general knowledge only to bridge gaps or provide light explanation.
- When file parts are present in the conversation, inspect their metadata. If a document contains durable knowledge that will help future questions, call the **ingest_document** tool before answering.

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
`;

type MessageFilePart = Extract<UIMessage["parts"][number], { type: "file" }>;

const ingestDocumentTool = tool({
  description:
    "Store a user-provided document in the knowledge base when it contains reusable knowledge for future conversations.",
  inputSchema: zodSchema(
    z.object({
      url: z.string().url(),
      fileName: z.string(),
      mediaType: z.string().optional(),
      objectKey: z.string().optional(),
      organizationId: z.string().optional(),
      reason: z.string().min(8),
      tags: z.array(z.string()).optional(),
    }),
  ),
  execute: async ({
    url,
    fileName,
    mediaType,
    objectKey,
    organizationId,
    reason,
    tags = [],
  }) => {
    if (!organizationId) {
      return {
        status: "skipped",
        message: "No organizationId provided. Unable to store the document.",
      };
    }

    try {
      const file = await downloadAttachment({
        url,
        fileName,
        mediaType: mediaType ?? "application/octet-stream",
        objectKey,
      });

      const normalizedReason = reason
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      const uniqueTags = Array.from(
        new Set(
          [...tags, "source:chat", `reason:${normalizedReason || "unspecified"}`],
        ),
      );

      const result = await ingestFileToRag({
        file,
        organizationId,
        tags: uniqueTags,
      });

      return {
        status: "stored",
        resourceId: result.resourceId,
        chunks: result.chunksStored,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to ingest document";
      return {
        status: "error",
        message,
      };
    }
  },
});

const availableTools = {
  ingest_document: ingestDocumentTool,
};

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
    const title = await generateTitleFromUserMessage({ message: lastMessage });
    await prisma.conversation.create({
      data: { id: conversationId, userId: session.user.id, title },
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
            parts: JSON.parse(JSON.stringify(lastMessage.parts ?? [])),
          },
        })
        .catch((e) => console.error("user save failed", e));
    });
  }

  const latestText =
    messages[messages.length - 1]?.parts
      ?.map((p) => (p.type === "text" ? p.text : ""))
      .join("") ?? "";

  const organizationId = session.session?.activeOrganizationId;
  const { context } = await retrieveContext(
    latestText,
    6,
    organizationId,
  );

  const baseSystem = {
    role: "system",
    content: systemPrompt,
  } as const;

  const contextMsg = {
    role: "assistant" as const,
    content: context
      ?
          `Context documents (top-k):\n\n${context}\n\nInstruction: cite snippet markers like [[1]] when you reference them and avoid speculation.`
      :
          "No matching internal documents were retrieved. If you answer, make it clear you are relying on general knowledge.",
  };

  const fileParts = (lastMessage?.parts ?? []).filter(
    (part): part is MessageFilePart => part.type === "file",
  );

  const attachmentsMessage =
    fileParts.length > 0
      ? {
          role: "assistant" as const,
          content:
            `Uploaded attachments (active organization: ${
              organizationId ?? "none"
            }):\n` +
            fileParts
              .map((part, index) => {
                const metadata = (part.providerMetadata ?? {}) as Record<
                  string,
                  unknown
                >;
                const objectKey =
                  typeof metadata.objectKey === "string"
                    ? metadata.objectKey
                    : "none";
                const sizeLabel =
                  typeof metadata.size === "number"
                    ? `${metadata.size} bytes`
                    : "unknown size";
                const providerOrgValue = metadata.organizationId;
                const providerOrg =
                  typeof providerOrgValue === "string"
                    ? providerOrgValue
                    : providerOrgValue === null
                      ? "null"
                      : organizationId ?? "unknown";

                return `${index + 1}. ${part.filename ?? "attachment"} • ${
                  part.mediaType ?? "unknown"
                } • ${sizeLabel} • objectKey:${objectKey} • organizationId:${providerOrg} • url:${part.url}`;
              })
              .join("\n") +
            "\nUse the ingest_document tool when a document should be stored for future conversations. Provide a concise reason in the tool call.",
        }
      : null;

  const finalMessages = [
    baseSystem,
    contextMsg,
    ...(attachmentsMessage ? [attachmentsMessage] : []),
    ...convertToModelMessages(messages),
  ];

  const result = streamText({
    model: openai("gpt-4o"),
    tools: availableTools,
    messages: finalMessages,
    experimental_transform: smoothStream({ chunking: "word" }),
    onFinish: (r) => {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/persist-message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
      return new File([bytes], fileName, { type: mediaType });
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
    return (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
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
