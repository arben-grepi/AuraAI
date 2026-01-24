import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import crypto from "crypto";
import { extractText } from "@/lib/file-extraction";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 300;
const EXPECTED_VECTOR_DIMENSION = 1536;

function validateVector(vec: number[]): void {
  if (!Array.isArray(vec)) {
    throw new Error("Vector must be an array");
  }
  if (vec.length !== EXPECTED_VECTOR_DIMENSION) {
    throw new Error(
      `Vector dimension mismatch: expected ${EXPECTED_VECTOR_DIMENSION}, got ${vec.length}`,
    );
  }
  for (let i = 0; i < vec.length; i++) {
    const val = vec[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(`Invalid vector value at index ${i}: ${val}`);
    }
  }
}

function toPgVectorLiteral(vec: number[]): string {
  validateVector(vec);
  const sanitized = vec.map((v) => {
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid vector value: ${v}`);
    }
    return v;
  });
  return `'[${sanitized.join(",")}]'::vector`;
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();

    const tagsString = form.get("tags")?.toString();
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
        return Response.json(
          { error: "Invalid tags format. Expected JSON array." },
          { status: 400 },
        );
      }
    }

    const file = form.get("file");
    const orgId = form.get("orgId")?.toString();
    const orgSlug = form.get("orgSlug")?.toString();
    const fileFolderId = form.get("fileFolderId")?.toString() || null;

    let organizationId: string | null = null;

    if (orgId) {
      organizationId = orgId;
    } else if (orgSlug) {
      const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true },
      });

      if (!org) {
        return Response.json(
          { error: `Organization with slug "${orgSlug}" not found` },
          { status: 404 },
        );
      }

      organizationId = org.id;
    }

    if (!organizationId) {
      return Response.json(
        {
          error:
            "No organization specified. Please provide an orgId or orgSlug.",
        },
        { status: 400 },
      );
    }

    // Verify user has access to this organization
    if (session.user.role !== "admin") {
      const membership = await prisma.member.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
        },
        select: { id: true },
      });

      if (!membership) {
        return Response.json(
          { error: "Unauthorized: You don't have access to this organization" },
          { status: 403 },
        );
      }
    }

    if (!(file instanceof File)) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    const isTXT = file.type === "text/plain" || file.name.endsWith(".txt");
    const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");

    if (!isTXT && !isPDF) {
      return Response.json(
        { error: "Only .txt and .pdf files are supported" },
        { status: 415 },
      );
    }

    const text = await extractText(file);

    if (!text) {
      return Response.json({ error: "File is empty" }, { status: 400 });
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });

    const docs = await splitter.createDocuments(
      [text],
      [{ source: file.name, docType: isPDF ? "pdf" : "txt" }],
    );

    const chunks = docs.map((d) => d.pageContent);

    if (!chunks.length) {
      return Response.json(
        { error: "No meaningful text to embed after preprocessing" },
        { status: 400 },
      );
    }

    console.log(`RAG: Extracted ${chunks.length} chunks from ${file.name}`);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const embRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: chunks,
    });

    const vectors = embRes.data.map((d) => d.embedding as number[]);

    if (fileFolderId) {
      const folder = await prisma.fileFolder.findFirst({
        where: { id: fileFolderId, organizationId },
      });
      if (!folder) {
        return Response.json(
          { error: "Folder not found or does not belong to this organization" },
          { status: 400 },
        );
      }
    }

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

      for (let i = 0; i < vectors.length; i++) {
        const id = crypto.randomUUID();
        const content = chunks[i];
        const vectorLiteral = toPgVectorLiteral(vectors[i]);

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

    return Response.json({ ok: true, fileName: file.name, ...result });
  } catch (e: unknown) {
    console.error("RAG upload error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
