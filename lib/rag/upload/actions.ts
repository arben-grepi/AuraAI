"use server";

import crypto from "crypto";
import prisma from "@/lib/prisma";
import { generateEmbeddings } from "../embeddings";
import { chunkContentWithOffsets } from "../chunking";
import { toPgVectorLiteral } from "../vector";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { extractText, isSupportedRagFile } from "@/lib/file-extraction";
import { isSystemAdmin } from "@/lib/auth-utils";
import { MAX_ORG_RAG_FILES, ORG_RAG_FILE_LIMIT_ERROR } from "@/lib/rag/limits";

export type ProcessRagFileResult =
  | { success: true; resourceId: string; chunksStored: number; fileName: string }
  | { success: false; error: string };

export async function processRagFile(
  formData: FormData,
): Promise<ProcessRagFileResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file uploaded" };
  }

  if (!isSupportedRagFile(file)) {
    return {
      success: false,
      error:
        "Unsupported file type. Supported: .pdf, .txt, .md, .csv, .json, .html, .xml, .docx, .xlsx, .xls",
    };
  }

  const orgId = formData.get("orgId")?.toString() ?? null;
  const orgSlug = formData.get("orgSlug")?.toString() ?? null;
  const fileFolderId = formData.get("fileFolderId")?.toString() || null;
  const tagsString = formData.get("tags")?.toString();
  let tags: string[] = [];
  if (tagsString) {
    try {
      const parsed = JSON.parse(tagsString);
      if (Array.isArray(parsed)) {
        tags = parsed.filter(
          (tag): tag is string => typeof tag === "string",
        );
      }
    } catch {
      return { success: false, error: "Invalid tags format. Expected JSON array." };
    }
  }

  let organizationId: string | null = orgId;

  if (!organizationId && orgSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true },
    });
    if (!org) {
      return {
        success: false,
        error: `Organization with slug "${orgSlug}" not found`,
      };
    }
    organizationId = org.id;
  }

  if (!organizationId) {
    return {
      success: false,
      error:
        "No organization specified. Provide orgId or orgSlug.",
    };
  }

  if (!isSystemAdmin(session.user.role)) {
    const membership = await prisma.member.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
      select: { id: true },
    });
    if (!membership) {
      return {
        success: false,
        error: "Unauthorized: You don't have access to this organization",
      };
    }
  }

  if (fileFolderId) {
    const folder = await prisma.fileFolder.findFirst({
      where: { id: fileFolderId, organizationId },
    });
    if (!folder) {
      return {
        success: false,
        error: "Folder not found or does not belong to this organization",
      };
    }
  }

  let fullText: string;
  try {
    fullText = await extractText(file);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to extract text";
    return { success: false, error: message };
  }

  if (!fullText?.trim()) {
    return { success: false, error: "File is empty" };
  }

  // Sentence-aware chunking with offsets
  const chunks = chunkContentWithOffsets(fullText.trim());
  if (!chunks.length) {
    return {
      success: false,
      error: "No meaningful text to embed after preprocessing",
    };
  }

  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddings(chunks.map((c) => c.text));
  } catch (e) {
    console.error("RAG embedding error:", e);
    const message = (() => {
      if (e && typeof e === "object") {
        const maybeStatus = (e as { statusCode?: unknown }).statusCode;
        const statusCode = typeof maybeStatus === "number" ? maybeStatus : null;
        const maybeData = (e as { data?: unknown }).data as
          | { error?: { code?: unknown; message?: unknown } }
          | undefined;
        const code =
          typeof maybeData?.error?.code === "string" ? maybeData.error.code : null;
        const apiMessage =
          typeof maybeData?.error?.message === "string"
            ? maybeData.error.message
            : null;

        // OpenAI quota / billing issues (commonly surfaced as 429 + insufficient_quota).
        if (statusCode === 429 || code === "insufficient_quota") {
          return (
            "AI embeddings are temporarily unavailable (quota exceeded). " +
            "Please check your AI provider billing/limits, or switch to a local embedding provider (AI_PROVIDER=ollama)."
          );
        }

        // Some SDKs only expose the string message.
        const rawMessage =
          e instanceof Error ? e.message : apiMessage ?? "Failed to generate embeddings.";
        if (
          typeof rawMessage === "string" &&
          (rawMessage.includes("insufficient_quota") ||
            rawMessage.includes("You exceeded your current quota"))
        ) {
          return (
            "AI embeddings are temporarily unavailable (quota exceeded). " +
            "Please check your AI provider billing/limits, or switch to a local embedding provider (AI_PROVIDER=ollama)."
          );
        }
      }

      return "Failed to generate embeddings.";
    })();
    return {
      success: false,
      error: message,
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const organizationFileCount = await tx.resource.count({
        where: { organizationId },
      });
      if (organizationFileCount >= MAX_ORG_RAG_FILES) {
        throw new Error(ORG_RAG_FILE_LIMIT_ERROR);
      }

      const resourceId = crypto.randomUUID();

      // Store resource with full text, mime type, and file size
      await tx.$executeRawUnsafe(
        `INSERT INTO "resources" ("id", "organization_id", "file_folder_id", "name", "tags", "full_text", "mime_type", "file_size")
         VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8)`,
        resourceId,
        organizationId,
        fileFolderId,
        file.name,
        tags,
        fullText.trim(),
        file.type || null,
        file.size,
      );

      // Insert embeddings with offsets
      const valuesSqlParts: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      for (let i = 0; i < embeddings.length; i++) {
        const id = crypto.randomUUID();
        const chunk = chunks[i];
        const vectorLiteral = toPgVectorLiteral(embeddings[i]);

        valuesSqlParts.push(
          `($${paramIndex}, $${paramIndex + 1}, ${vectorLiteral}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}::text[], $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`,
        );
        params.push(
          id,
          chunk.text,
          resourceId,
          file.name,
          tags,
          chunk.startOffset,
          chunk.endOffset,
          chunk.index,
        );
        paramIndex += 8;
      }

      const sql = `
        INSERT INTO "embeddings" ("id","content","embedding","resource_id","file_name","tags","start_offset","end_offset","chunk_index")
        VALUES ${valuesSqlParts.join(",")}
      `;
      await tx.$executeRawUnsafe(sql, ...params);

      return { resourceId, chunksStored: chunks.length };
    });

    return {
      success: true,
      fileName: file.name,
      resourceId: result.resourceId,
      chunksStored: result.chunksStored,
    };
  } catch (e) {
    console.error("RAG upload DB error:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to save to database",
    };
  }
}
