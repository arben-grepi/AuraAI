import { betterFetch } from "@better-fetch/fetch";
import type { auth as AuthType } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

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
  if (pathname.startsWith("/admin")) {
    // Check if user has admin role
    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Allow admin users to proceed
    return NextResponse.next();
  }

  // Check org edit routes
  // if (pathname.startsWith("/org/") && pathname !== "/org") {
  //   console.log("Checking org edit routes");
  //   // Extract slug from pathname (e.g., /org/my-slug/general -> my-slug)
  //   const pathParts = pathname.split("/");
  //   if (pathParts.length >= 3 && pathParts[1] === "org") {
  //     const slug = pathParts[2];
  //     console.log("Slug:", slug);
  //     try {
  //       // Get organization by slug via API (Edge-compatible)
  //       const orgResponse = await betterFetch<{ id: string }>(
  //         `/api/org?slug=${slug}`,
  //         {
  //           baseURL: request.nextUrl.origin,
  //           headers: {
  //             cookie: request.headers.get("cookie") || "",
  //           },
  //         },
  //       );
  //       console.log("Org response:", orgResponse);
  //       if (!orgResponse?.data?.id) {
  //         return NextResponse.redirect(new URL("/", request.url));
  //       }

  //       // Check user's membership via API
  //       const membersResponse = await betterFetch<{
  //         members: Array<{ user: { id: string }; role: string }>;
  //       }>(`/api/admin/organizations/members?org=${orgResponse.data.id}`, {
  //         baseURL: request.nextUrl.origin,
  //         headers: {
  //           cookie: request.headers.get("cookie") || "",
  //         },
  //       });
  //       console.log("Members response:", membersResponse);
  //       // Check if user is owner or admin
  //       const userMember = membersResponse?.data?.members?.find(
  //         (member) => member.user.id === session.user.id,
  //       );
  //       console.log("User member:", userMember);
  //       if (
  //         !userMember ||
  //         (userMember.role !== "owner" && userMember.role !== "admin")
  //       ) {
  //         console.log("User is not owner or admin, redirecting to home");
  //         return NextResponse.redirect(new URL("/", request.url));
  //       }
  //     } catch {
  //       // If there's an error checking membership, deny access
  //       console.log("Error checking membership, redirecting to home");
  //       return NextResponse.redirect(new URL("/", request.url));
  //     }
  //   }
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
