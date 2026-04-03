import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getCorrelationId } from "@/lib/ops-log";
import { processRagFile } from "@/lib/rag/upload/actions";
import { isSupportedRagFile } from "@/lib/file-extraction";
import { ORG_RAG_FILE_LIMIT_ERROR } from "@/lib/rag/limits";

function statusFromError(error: string): number {
  if (error === "Unauthorized") return 401;
  if (error.startsWith("Unauthorized:")) return 403;
  if (error.includes("not found")) return 404;
  if (error.includes("Unsupported file type")) return 415;
  if (error.includes(ORG_RAG_FILE_LIMIT_ERROR)) return 409;
  if (error.toLowerCase().includes("quota exceeded")) return 429;
  return 400;
}

export async function POST(req: Request) {
  const requestId = getCorrelationId(req);
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "x-request-id": requestId } },
      );
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "No file uploaded" },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    if (!isSupportedRagFile(file)) {
      return Response.json(
        {
          error:
            "Unsupported file type. Supported: .pdf, .txt, .md, .csv, .json, .html, .xml",
        },
        { status: 415, headers: { "x-request-id": requestId } },
      );
    }

    const result = await processRagFile(form, { requestId });

    if (result.success) {
      return Response.json(
        {
          ok: true,
          fileName: result.fileName,
          resourceId: result.resourceId,
          chunksStored: result.chunksStored,
        },
        { headers: { "x-request-id": requestId } },
      );
    }

    const status = statusFromError(result.error);
    return Response.json(
      { error: result.error, errorCode: result.errorCode ?? null },
      { status, headers: { "x-request-id": requestId } },
    );
  } catch (e: unknown) {
    console.error("RAG upload error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}
