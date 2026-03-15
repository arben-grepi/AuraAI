import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: {
      organization: { select: { name: true, slug: true } },
      user: { select: { email: true, name: true } },
    },
  });

  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: "Invitation not found or expired" },
      { status: 404 },
    );
  }

  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invitation is for a different email address" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    organizationName: invitation.organization.name,
    organizationSlug: invitation.organization.slug,
    inviterEmail: invitation.user.email,
    inviterName: invitation.user.name,
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id },
    include: { organization: { select: { name: true, slug: true } } },
  });

  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: "Invitation not found or expired" },
      { status: 404 },
    );
  }

  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "This invitation is for a different email address" },
      { status: 403 },
    );
  }

  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId: invitation.organizationId,
      userId: session.user.id,
    },
  });

  if (existingMember) {
    await prisma.invitation.update({
      where: { id },
      data: { status: "accepted" },
    });
    return NextResponse.json({
      success: true,
      organizationSlug: invitation.organization.slug,
    });
  }

  await prisma.$transaction([
    prisma.member.create({
      data: {
        id: crypto.randomBytes(16).toString("hex"),
        organizationId: invitation.organizationId,
        userId: session.user.id,
        role: invitation.role || "member",
        createdAt: new Date(),
      },
    }),
    prisma.invitation.update({
      where: { id },
      data: { status: "accepted" },
    }),
  ]);

  return NextResponse.json({
    success: true,
    organizationSlug: invitation.organization.slug,
  });
}
