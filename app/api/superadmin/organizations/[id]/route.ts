import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { maxMembers } = await request.json();

    if (maxMembers !== null && (typeof maxMembers !== "number" || maxMembers < 1)) {
      return NextResponse.json(
        { error: "maxMembers must be a positive number or null" },
        { status: 400 },
      );
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { maxMembers },
    });

    return NextResponse.json({ success: true, maxMembers: updated.maxMembers });
  } catch (error) {
    console.error("Failed to update organization limits:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 },
    );
  }
}
