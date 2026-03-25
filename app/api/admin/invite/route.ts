import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isSystemAdmin } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";
import { sendOrganizationInvitation } from "@/email/email";
import crypto from "crypto";

async function inviteOne({
  email,
  role,
  organizationId,
  organizationName,
  inviterId,
  inviterName,
  inviterEmail,
  baseURL,
}: {
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  inviterId: string;
  inviterName: string;
  inviterEmail: string;
  baseURL: string;
}): Promise<{ email: string; success: boolean; error?: string; devInviteLink?: string }> {
  const normalised = email.toLowerCase();

  const existing = await prisma.member.findFirst({
    where: { organizationId, user: { email: normalised } },
  });
  if (existing) return { email: normalised, success: false, error: "Already a member" };

  const pending = await prisma.invitation.findFirst({
    where: { organizationId, email: normalised, status: "pending" },
  });
  if (pending) return { email: normalised, success: false, error: "Invitation already pending" };

  const invitation = await prisma.invitation.create({
    data: {
      id: crypto.randomBytes(16).toString("hex"),
      organizationId,
      email: normalised,
      role,
      status: "pending",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      inviterId,
    },
  });

  const inviteLink = `${baseURL}/accept-invite/${invitation.id}`;

  try {
    const result = await sendOrganizationInvitation({
      email: normalised,
      invitedByUsername: inviterName,
      invitedByEmail: inviterEmail,
      teamName: organizationName,
      inviteLink,
    });
    return { email: normalised, success: true, devInviteLink: result.devInviteLink };
  } catch (err) {
    return {
      email: normalised,
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

export async function POST(request: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session || !isSystemAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { role, organizationSlug } = body;

    // Accept a single email (legacy) or an array for bulk invites.
    const emails: string[] = body.emails
      ? body.emails
      : body.email
        ? [body.email]
        : [];

    if (!emails.length || !role || !organizationSlug) {
      return NextResponse.json(
        { error: "emails (or email), role, and organizationSlug are required" },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const baseURL =
      process.env.NODE_ENV === "production"
        ? process.env.BETTER_AUTH_URL
        : "http://localhost:3000";

    const results = await Promise.all(
      emails.map((email) =>
        inviteOne({
          email,
          role,
          organizationId: organization.id,
          organizationName: organization.name,
          inviterId: session.user.id,
          inviterName: session.user.name,
          inviterEmail: session.user.email,
          baseURL: baseURL ?? "http://localhost:3000",
        }),
      ),
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Failed to process invitations:", error);
    const message = error instanceof Error ? error.message : "Failed to send invitations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
