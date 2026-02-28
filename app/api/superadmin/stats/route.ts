import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [organizations, users, admins, conversations, messages] =
      await Promise.all([
        prisma.organization.count(),
        prisma.user.count(),
        prisma.user.count({ where: { role: "admin" } }),
        prisma.conversation.count(),
        prisma.message.count(),
      ]);

    return NextResponse.json({
      organizations,
      users,
      admins,
      conversations,
      messages,
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
