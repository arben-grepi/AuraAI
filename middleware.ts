import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

type Session = typeof auth.$Infer.Session;

export async function middleware(request: NextRequest) {
  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    },
  );

  if (!session) {
    console.log("No session found, redirecting to sign-in");
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  console.log("Session found, redirecting to home");

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
