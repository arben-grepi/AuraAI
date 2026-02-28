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
      // Superadmin sees all users
      const users = await auth.api.listUsers({
        query: {
          limit: 100,
          offset: 0,
        },
        headers: await headers(),
      });
      return NextResponse.json(users);
    }

    // Admin sees only users who are members of orgs they own
    const users = await prisma.user.findMany({
      where: {
        members: {
          some: {
            organization: {
              members: {
                some: {
                  userId: session.user.id,
                  role: "owner",
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        banned: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 },
    );
  }
}
