"use server";

import crypto from "crypto";
import prisma from "@/lib/prisma";
import { generateEmbeddings } from "../embeddings";
import { chunkContent } from "../chunking";
import { toPgVectorLiteral } from "../vector";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { extractText, isSupportedRagFile } from "@/lib/file-extraction";

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
        "Unsupported file type. Supported: .pdf, .txt, .md, .csv, .json, .html, .xml",
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

  if (session.user.role !== "admin") {
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

  let text: string;
  try {
    text = await extractText(file);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to extract text";
    return { success: false, error: message };
  }

  if (!text?.trim()) {
    return { success: false, error: "File is empty" };
  }

  const chunks = await chunkContent(text);
  if (!chunks.length) {
    return {
      success: false,
      error: "No meaningful text to embed after preprocessing",
    };
  }

  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddings(chunks);
  } catch (e) {
    console.error("RAG embedding error:", e);
    return {
      success: false,
      error: "Failed to generate embeddings. Ensure Ollama is running with nomic-embed-text.",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const resourceId = crypto.randomUUID();

      await tx.$executeRawUnsafe(
        `INSERT INTO "resources" ("id", "organization_id", "file_folder_id", "name", "tags") VALUES ($1, $2, $3, $4, $5::text[])`,
        resourceId,
        organizationId,
        fileFolderId,
        file.name,
        tags,
      );

      const valuesSqlParts: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      for (let i = 0; i < embeddings.length; i++) {
        const id = crypto.randomUUID();
        const content = chunks[i];
        const vectorLiteral = toPgVectorLiteral(embeddings[i]);

        valuesSqlParts.push(
          `($${paramIndex}, $${paramIndex + 1}, ${vectorLiteral}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}::text[])`,
        );
        params.push(id, content, resourceId, file.name, tags);
        paramIndex += 5;
      }

      const sql = `
        INSERT INTO "embeddings" ("id","content","embedding","resource_id","file_name","tags")
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
