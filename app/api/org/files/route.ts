import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  // Verify user has access to this organization
  if (session.user.role !== "admin") {
    const membership = await prisma.member.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const files = await prisma.resource.findMany({
    where: {
      organizationId: orgId,
    },
    include: {
      embeddings: false,
    },
  });

  return NextResponse.json(files);
}
