import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { sendOrganizationInvitation } from "@/email/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email, role, organizationId } = await request.json();

    if (!email || !role || !organizationId) {
      return NextResponse.json(
        { error: "Email, role, and organizationId are required" },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const existingMember = await prisma.member.findFirst({
      where: { organizationId, user: { email: email.toLowerCase() } },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 400 },
      );
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organizationId,
        email: email.toLowerCase(),
        status: "pending",
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "User is already invited to this organization" },
        { status: 400 },
      );
    }

    const invitation = await prisma.invitation.create({
      data: {
        id: crypto.randomBytes(16).toString("hex"),
        organizationId,
        email: email.toLowerCase(),
        role,
        status: "pending",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        inviterId: session.user.id,
      },
    });

    const baseURL =
      process.env.NODE_ENV === "production"
        ? process.env.BETTER_AUTH_URL
        : "http://localhost:3000";

    await sendOrganizationInvitation({
      email: invitation.email,
      invitedByUsername: session.user.name,
      invitedByEmail: session.user.email,
      teamName: organization.name,
      inviteLink: `${baseURL}/accept-invite/${invitation.id}`,
    });

    return NextResponse.json(invitation);
  } catch (error) {
    console.error("Failed to send invitation:", error);
    const message =
      error instanceof Error ? error.message : "Failed to send invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
