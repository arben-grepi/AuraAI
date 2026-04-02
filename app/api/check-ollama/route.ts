import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  try {
    const res = await fetch(`${baseURL}/api/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return Response.json({ available: res.ok });
  } catch {
    return Response.json({ available: false });
  }
}
