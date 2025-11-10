import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  console.log(`[API /user/first-org] Request received`);

  // Get headers from request (for middleware calls) or next/headers (for regular calls)
  const requestHeaders = new Headers();
  req.headers.forEach((value, key) => {
    requestHeaders.set(key, value);
  });

  // If no cookies in request headers, try to get from next/headers
  if (!requestHeaders.get("cookie")) {
    const nextHeaders = await headers();
    nextHeaders.forEach((value, key) => {
      if (!requestHeaders.has(key)) {
        requestHeaders.set(key, value);
      }
    });
  }

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    console.log(`[API /user/first-org] No session found`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(
    `[API /user/first-org] Session found - User ID: ${session.user.id}, Role: ${session.user.role}`,
  );

  if (session.user.role === "admin") {
    console.log(`[API /user/first-org] Admin user, returning null slug`);
    return NextResponse.json({ slug: null });
  }

  console.log(
    `[API /user/first-org] Fetching membership for user: ${session.user.id}`,
  );
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: {
        select: { slug: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const slug = membership?.organization?.slug || null;
  console.log(`[API /user/first-org] Returning slug: ${slug}`);

  return NextResponse.json({
    slug,
  });
}
