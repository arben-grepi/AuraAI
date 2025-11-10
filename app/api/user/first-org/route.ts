import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "admin") {
    return NextResponse.json({ slug: null });
  }

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: {
        select: { slug: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    slug: membership?.organization?.slug || null,
  });
}

