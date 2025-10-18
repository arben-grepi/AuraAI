// app/api/pdf-parse/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import PDFParser from "pdf2json";
import { PrismaClient } from "@/app/generated/prisma";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

export const runtime = "nodejs";

const prisma = new PrismaClient();

// ---------- config ----------
const EMBED_MODEL = openai.embedding("text-embedding-3-small"); // 1536 dims
const CHUNK_SIZE = 1200; // chars (simple + safe)
const CHUNK_OVERLAP = 150; // chars
// ----------------------------

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    out.push(text.slice(i, end));
    i += Math.max(1, size - overlap);
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { path, source, meta } = (await req.json()) as {
      path?: string;
      source?: string;
      meta?: any;
    };
    if (!path) {
      return NextResponse.json(
        { error: "Missing 'path' in body" },
        { status: 400 },
      );
    }

    await fs.access(path);
    const buffer = await fs.readFile(path);

    // -------- pdf2json: parse -> text --------
    const { numpages, text } = await new Promise<{
      numpages: number;
      text: string;
    }>((resolve, reject) => {
      const pdfParser = new (PDFParser as any)(null, 1);
      pdfParser.on("pdfParser_dataError", (e: any) =>
        reject(new Error(e?.parserError || "PDF parse error")),
      );
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        const pages = pdfData?.formImage?.Pages ?? [];
        const numpages = pages.length;

        const parts: string[] = [];
        for (const page of pages) {
          for (const t of page.Texts ?? []) {
            for (const r of t.R ?? []) {
              parts.push(decodeURIComponent(r.T || ""));
            }
          }
        }
        let text = parts
          .join(" ")
          .replace(/\u00a0/g, " ")
          .replace(/[ \t]+/g, " ")
          .trim();

        if (!text) {
          try {
            const raw = (pdfParser as any).getRawTextContent?.();
            if (typeof raw === "string") {
              text = raw
                .replace(/\u00a0/g, " ")
                .replace(/[ \t]+/g, " ")
                .trim();
            }
          } catch {}
        }
        resolve({ numpages, text });
      });

      // harmless warning about fake worker is expected
      pdfParser.parseBuffer(buffer);
    });

    if (!text) {
      return NextResponse.json({
        numpages,
        chunks: 0,
        docId: null,
        note: "No extractable text found. The PDF is likely image-only (scanned). Add an OCR step before embedding.",
      });
    }

    // -------- chunk --------
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return NextResponse.json({
        numpages,
        chunks: 0,
        docId: null,
        note: "Text too short after cleanup.",
      });
    }

    // -------- embed --------
    const { embeddings } = await embedMany({
      model: EMBED_MODEL,
      values: chunks,
    }); // Float32Array[]

    // -------- store (Prisma + raw for vector/tsv) --------
    const created = await prisma.$transaction(async (tx) => {
      const doc = await tx.doc.create({
        data: {
          source: source ?? path,
          meta: meta ?? { pages: numpages },
        },
      });

      // Insert each chunk. We use raw SQL to cast to vector and build tsv.
      for (let i = 0; i < chunks.length; i++) {
        await tx.$executeRawUnsafe(
          `
          INSERT INTO doc_chunks (doc_id, ord, content, embedding, tsv)
          VALUES ($1::uuid, $2, $3, $4::vector, to_tsvector('simple', unaccent($3)))
          `,
          doc.id,
          i,
          chunks[i],
          embeddings[i], // pg accepts Float32Array and casts to vector via ::vector
        );
      }

      return { docId: doc.id };
    });

    return NextResponse.json({
      ok: true,
      numpages,
      chunks: chunks.length,
      docId: created.docId,
      model: "text-embedding-3-small (1536 dims)",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Ingestion failed", message: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
