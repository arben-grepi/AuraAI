import { auth } from "@/lib/auth";
import { APIError } from "better-auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isSystemAdmin, isSuperAdmin } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSystemAdmin(session.user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    if (isSuperAdmin(session.user.role)) {
      // Superadmin sees all organizations with member counts
      const organizations = await prisma.organization.findMany({
        include: {
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      const result = organizations.map((org) => ({
        ...org,
        memberCount: org._count.members,
        _count: undefined,
      }));
      return NextResponse.json(result);
    }

    // Admin sees only organizations they are an owner of
    const ownedOrgs = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
            role: "owner",
          },
        },
      },
    });
    return NextResponse.json(ownedOrgs);
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to list organizations" },
      { status: 500 },
    );
  }
}
