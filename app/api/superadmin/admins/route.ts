import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
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
    const admins = await prisma.user.findMany({
      where: { role: "admin" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        role: true,
        maxOrgs: true,
        members: {
          where: { role: "owner" },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = admins.map((admin) => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      image: admin.image,
      createdAt: admin.createdAt,
      role: admin.role,
      maxOrgs: admin.maxOrgs,
      ownedOrgCount: admin.members.length,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch admins:", error);
    return NextResponse.json(
      { error: "Failed to fetch admins" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    await auth.api.setRole({
      headers: reqHeaders,
      body: { userId, role: "admin" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to promote user:", error);
    return NextResponse.json(
      { error: "Failed to promote user" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId, maxOrgs } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    if (maxOrgs !== null && (typeof maxOrgs !== "number" || maxOrgs < 1)) {
      return NextResponse.json(
        { error: "maxOrgs must be a positive number or null" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { maxOrgs },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update admin limits:", error);
    return NextResponse.json(
      { error: "Failed to update admin limits" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: "user" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to demote admin:", error);
    return NextResponse.json(
      { error: "Failed to demote admin" },
      { status: 500 },
    );
  }
}
