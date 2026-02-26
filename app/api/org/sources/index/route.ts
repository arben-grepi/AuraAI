import crypto from "crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { crawlWebsite } from "@/lib/rag/crawl";
import { chunkContentWithOffsets } from "@/lib/rag/chunking";
import { generateEmbeddings } from "@/lib/rag/embeddings";
import { toPgVectorLiteral } from "@/lib/rag/vector";
import { NextRequest } from "next/server";

type ProgressEvent =
  | { type: "crawl_progress"; url: string; pagesFound: number; pagesCrawled: number }
  | { type: "crawl_done"; totalPages: number }
  | { type: "indexing_page"; page: number; total: number; url: string; title: string }
  | { type: "page_indexed"; page: number; total: number; chunks: number }
  | { type: "page_skipped"; page: number; total: number; reason: string }
  | { type: "done"; pagesIndexed: number; totalChunks: number }
  | { type: "error"; message: string };

function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: ProgressEvent,
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return Response.json(
      { error: "organizationId is required" },
      { status: 400 },
    );
  }

  // Verify membership
  if (session.user.role !== "admin") {
    const membership = await prisma.member.findFirst({
      where: { organizationId, userId: session.user.id },
      select: { role: true },
    });
    if (!membership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const indexes = await prisma.sourceIndex.findMany({
    where: { organizationId },
    select: {
      id: true,
      sourceUrl: true,
      lastIndexedAt: true,
      pagesIndexed: true,
      totalChunks: true,
    },
  });

  return Response.json(indexes);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { sourceUrl: string; organizationId: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { sourceUrl, organizationId } = body;
  if (!sourceUrl || !organizationId) {
    return Response.json(
      { error: "sourceUrl and organizationId are required" },
      { status: 400 },
    );
  }

  // Verify URL is valid
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Verify membership
  if (session.user.role !== "admin") {
    const membership = await prisma.member.findFirst({
      where: { organizationId, userId: session.user.id },
      select: { role: true },
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Verify the source URL is in the org's sources list
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { sources: true },
  });
  if (!org) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }
  if (!org.sources.includes(sourceUrl)) {
    return Response.json(
      { error: "URL is not in the organization's trusted sources" },
      { status: 400 },
    );
  }

  const hostname = parsedUrl.hostname;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Delete old resources for this source before re-crawling
        console.log(`[index] Deleting old resources for source:${hostname}`);
        await prisma.$executeRawUnsafe(
          `DELETE FROM "resources" WHERE "organization_id" = $1 AND "tags" @> ARRAY['web-scrape', $2]::text[]`,
          organizationId,
          `source:${hostname}`,
        );

        // Phase 1: Crawl the website
        console.log(`[index] Starting source indexing: ${sourceUrl} for org ${organizationId}`);
        const pages = await crawlWebsite(sourceUrl, (event) => {
          sendEvent(controller, encoder, {
            type: "crawl_progress",
            url: event.url,
            pagesFound: event.pagesFound,
            pagesCrawled: event.pagesCrawled,
          });
        });

        console.log(`[index] Crawl complete: ${pages.length} pages with content`);

        sendEvent(controller, encoder, {
          type: "crawl_done",
          totalPages: pages.length,
        });

        if (pages.length === 0) {
          console.log(`[index] No pages to index, finishing early`);

          // Upsert SourceIndex even for zero pages
          await prisma.sourceIndex.upsert({
            where: {
              organizationId_sourceUrl: { organizationId, sourceUrl },
            },
            create: {
              organizationId,
              sourceUrl,
              lastIndexedAt: new Date(),
              pagesIndexed: 0,
              totalChunks: 0,
            },
            update: {
              lastIndexedAt: new Date(),
              pagesIndexed: 0,
              totalChunks: 0,
            },
          });

          sendEvent(controller, encoder, {
            type: "done",
            pagesIndexed: 0,
            totalChunks: 0,
          });
          controller.close();
          return;
        }

        // Phase 2: Index each page through the RAG pipeline
        let pagesIndexed = 0;
        let totalChunks = 0;
        const tags = ["web-scrape", `source:${hostname}`];

        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];

          console.log(`[index] Processing page ${i + 1}/${pages.length}: ${page.url}`);

          sendEvent(controller, encoder, {
            type: "indexing_page",
            page: i + 1,
            total: pages.length,
            url: page.url,
            title: page.title,
          });

          try {
            // Sanitize content for PostgreSQL (remove null bytes)
            const cleanContent = page.content.replace(/\0/g, "");

            // Chunk the content
            const chunks = chunkContentWithOffsets(cleanContent);
            console.log(`[index]   Chunked into ${chunks.length} chunks (${cleanContent.length} chars)`);
            if (chunks.length === 0) {
              sendEvent(controller, encoder, {
                type: "page_skipped",
                page: i + 1,
                total: pages.length,
                reason: "No meaningful text after chunking",
              });
              continue;
            }

            // Generate embeddings
            console.log(`[index]   Generating embeddings for ${chunks.length} chunks...`);
            const embeddings = await generateEmbeddings(
              chunks.map((c) => c.text),
            );

            // Store in database
            const resourceId = crypto.randomUUID();
            const pageName = `${page.title} (${new URL(page.url).pathname})`;
            console.log(`[index]   Storing resource "${pageName}" (${resourceId})`);

            await prisma.$transaction(async (tx) => {
              await tx.$executeRawUnsafe(
                `INSERT INTO "resources" ("id", "organization_id", "file_folder_id", "name", "tags", "full_text", "mime_type", "file_size")
                 VALUES ($1, $2, $3, $4, $5::text[], $6, $7, $8)`,
                resourceId,
                organizationId,
                null,
                pageName,
                tags,
                cleanContent,
                "text/html",
                Buffer.byteLength(cleanContent, "utf8"),
              );

              const valuesSqlParts: string[] = [];
              const params: unknown[] = [];
              let paramIndex = 1;

              for (let j = 0; j < embeddings.length; j++) {
                const id = crypto.randomUUID();
                const chunk = chunks[j];
                const vectorLiteral = toPgVectorLiteral(embeddings[j]);

                valuesSqlParts.push(
                  `($${paramIndex}, $${paramIndex + 1}, ${vectorLiteral}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}::text[], $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`,
                );
                params.push(
                  id,
                  chunk.text,
                  resourceId,
                  pageName,
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
            });

            pagesIndexed++;
            totalChunks += chunks.length;
            console.log(`[index]   Indexed OK: ${page.url} (${chunks.length} chunks)`);

            sendEvent(controller, encoder, {
              type: "page_indexed",
              page: i + 1,
              total: pages.length,
              chunks: chunks.length,
            });
          } catch (err) {
            console.error(`[index]   FAILED to index page ${page.url}:`, err);
            sendEvent(controller, encoder, {
              type: "page_skipped",
              page: i + 1,
              total: pages.length,
              reason:
                err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        // Upsert SourceIndex record
        await prisma.sourceIndex.upsert({
          where: {
            organizationId_sourceUrl: { organizationId, sourceUrl },
          },
          create: {
            organizationId,
            sourceUrl,
            lastIndexedAt: new Date(),
            pagesIndexed,
            totalChunks,
          },
          update: {
            lastIndexedAt: new Date(),
            pagesIndexed,
            totalChunks,
          },
        });

        console.log(`[index] Finished: ${pagesIndexed} pages indexed, ${totalChunks} total chunks`);

        sendEvent(controller, encoder, {
          type: "done",
          pagesIndexed,
          totalChunks,
        });
      } catch (err) {
        console.error("[index] Fatal error:", err);
        sendEvent(controller, encoder, {
          type: "error",
          message: err instanceof Error ? err.message : "Indexing failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
