import { betterFetch } from "@better-fetch/fetch";
import type { auth as AuthType } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

type Session = typeof AuthType.$Infer.Session;

const loginRoutes = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/change-email",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Processing request: ${pathname}`);

  try {
    const { data: session } = await betterFetch<Session>(
      "/api/auth/get-session",
      {
        baseURL: process.env.BETTER_AUTH_URL || request.nextUrl.origin,
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      },
    );

    // If user is not authenticated and trying to access protected routes
    if (!session) {
      console.log(`[Middleware] No session found for ${pathname}`);
      // Allow access to auth pages
      if (loginRoutes.some((route) => pathname.startsWith(route))) {
        console.log(`[Middleware] Allowing access to auth page: ${pathname}`);
        return NextResponse.next();
      }
      // Redirect to sign-in for all other protected routes
      console.log(`[Middleware] Redirecting unauthenticated user to /sign-in`);
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    console.log(
      `[Middleware] Session found - User ID: ${session.user.id}, Role: ${session.user.role}`,
    );

    // Allow authenticated users to access auth pages (redirect handled at page level)
    // This prevents redirect loops in production

    // Check admin routes
    if (pathname.startsWith("/admin")) {
      console.log(`[Middleware] Admin route detected: ${pathname}`);
      // Check if user has admin role
      if (session.user.role !== "admin") {
        console.log(
          `[Middleware] Non-admin user trying to access admin route, redirecting to org chat`,
        );
        // Non-admin users trying to access admin routes - redirect to their org chat
        try {
          const apiUrl = `${request.nextUrl.origin}/api/user/first-org`;
          console.log(`[Middleware] Calling API: ${apiUrl}`);

          // Forward all headers, especially cookies
          const headers = new Headers();
          request.headers.forEach((value, key) => {
            headers.set(key, value);
          });

          const response = await fetch(apiUrl, {
            headers,
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(
              `API returned ${response.status}: ${response.statusText}`,
            );
          }

          const orgResponse = await response.json();
          console.log(
            `[Middleware] API response received:`,
            JSON.stringify(orgResponse),
          );

          if (orgResponse?.slug) {
            console.log(
              `[Middleware] Redirecting non-admin to org chat: /org/${orgResponse.slug}/chat`,
            );
            return NextResponse.redirect(
              new URL(`/org/${orgResponse.slug}/chat`, request.url),
            );
          }
          console.log(
            `[Middleware] No org found for non-admin user, redirecting to home`,
          );
        } catch (error) {
          console.error(`[Middleware] Error fetching user org:`, error);
          Sentry.captureException(error);
          // Fallback to home if API fails
        }
        return NextResponse.redirect(new URL("/", request.url));
      }
      // Allow admin users to proceed
      console.log(`[Middleware] Admin user accessing admin route, allowing`);
      return NextResponse.next();
    }

    // Home page - allow access (server-side redirect handled in page)
    if (pathname === "/") {
      console.log(
        `[Middleware] Home page access detected - allowing (page will handle redirect)`,
      );
    }

    // Check organization routes - verify org exists (membership checked in layout)
    if (pathname.startsWith("/org/") && pathname !== "/org") {
      console.log(`[Middleware] Org route detected: ${pathname}`);
      if (session.user.role === "admin") {
        console.log(`[Middleware] Admin user accessing org route, allowing`);
        return NextResponse.next();
      }

      const pathParts = pathname.split("/");
      if (pathParts.length >= 3 && pathParts[1] === "org") {
        const slug = pathParts[2];
        console.log(
          `[Middleware] Non-admin user accessing org route for slug: ${slug} (membership enforced in layout)`,
        );
      }

      return NextResponse.next();
    }

    // Allow access to all other routes
    console.log(`[Middleware] Allowing access to route: ${pathname}`);
    return NextResponse.next();
  } catch (error) {
    // Capture errors in Sentry
    console.error(
      `[Middleware] Error processing request for ${pathname}:`,
      error,
    );
    Sentry.captureException(error);
    // Re-throw to allow Next.js to handle it
    throw error;
  }
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
