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

function toPgVectorLiteral(vec: number[]) {
  return `'[${vec.join(",")}]'::vector`;
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const tagsString = form.get("tags")?.toString();
    const tags = tagsString ? JSON.parse(tagsString) : [];
    console.log("tags", tags);

    const file = form.get("file");
    const orgId = form.get("orgId")?.toString();
    const orgSlug = form.get("orgSlug")?.toString();

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

    const result = await prisma.$transaction(async (tx) => {
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
