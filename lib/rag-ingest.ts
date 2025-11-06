import crypto from "crypto";

import OpenAI from "openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import prisma from "@/lib/prisma";
import { extractText } from "@/lib/file-extraction";

const EMBEDDING_MODEL = "text-embedding-3-small";

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 300;

function toPgVectorLiteral(vec: number[]) {
  return `'[${vec.join(",")}]'::vector`;
}

export interface IngestFileOptions {
  file: File;
  organizationId: string;
  tags?: string[];
}

export interface IngestFileResult {
  resourceId: string;
  chunksStored: number;
  fileName: string;
}

export async function ingestFileToRag({
  file,
  organizationId,
  tags = [],
}: IngestFileOptions): Promise<IngestFileResult> {
  const isTXT = file.type === "text/plain" || file.name.endsWith(".txt");
  const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");

  if (!isTXT && !isPDF) {
    throw new Error("Only .txt and .pdf files are supported");
  }

  const text = await extractText(file);

  if (!text) {
    throw new Error("File is empty");
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const docs = await splitter.createDocuments(
    [text],
    [
      {
        source: file.name,
        docType: isPDF ? "pdf" : "txt",
      },
    ],
  );

  const chunks = docs.map((d) => d.pageContent);

  if (!chunks.length) {
    throw new Error("No meaningful text to embed after preprocessing");
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embRes = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: chunks,
  });

  const vectors = embRes.data.map((d) => d.embedding as number[]);

  return prisma.$transaction(async (tx) => {
    const resourceId = crypto.randomUUID();
    await tx.$executeRawUnsafe(
      `INSERT INTO "resources" ("id", "organization_id", "name", "tags") VALUES ($1, $2, $3, $4)`,
      resourceId,
      organizationId,
      file.name,
      tags,
    );

    const valuesSqlParts: string[] = [];
    const params: unknown[] = [];

    for (let i = 0; i < vectors.length; i++) {
      const id = crypto.randomUUID();
      const content = chunks[i];
      params.push(id, content, resourceId, file.name, tags);
      const vectorLiteral = toPgVectorLiteral(vectors[i]);
      const base = params.length;
      valuesSqlParts.push(
        `($${base - 4}, $${base - 3}, ${vectorLiteral}, $${base - 2}, $${base - 1}, $${base})`,
      );
    }

    const sql = `
      INSERT INTO "embeddings" ("id","content","embedding","resource_id","file_name","tags")
      VALUES ${valuesSqlParts.join(",")}
    `;
    await tx.$executeRawUnsafe(sql, ...params);

    return { resourceId, chunksStored: chunks.length, fileName: file.name };
  });
}
