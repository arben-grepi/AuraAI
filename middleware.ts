import { betterFetch } from "@better-fetch/fetch";
import type { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

type Session = typeof auth.$Infer.Session;

const loginRoutes = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/change-email",
];

export async function middleware(request: NextRequest) {
  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: process.env.BETTER_AUTH_URL || request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    },
  );

  const { pathname } = request.nextUrl;

  // If user is not authenticated and trying to access protected routes
  if (!session) {
    // Allow access to auth pages
    if (loginRoutes.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }
    // Redirect to sign-in for all other protected routes
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // If user is authenticated and trying to access auth pages, redirect to home
  if (loginRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check admin routes
  // if (pathname.startsWith("/admin")) {
  //   // Check if user has admin role
  //   if (session.user.role !== "admin") {
  //     return NextResponse.redirect(new URL("/", request.url));
  //   }
  //   // Allow admin users to proceed
  //   return NextResponse.next();
  // }

  // Allow access to all other routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// Use Node.js runtime to avoid edge runtime fetch issues
export const runtime = "nodejs";
