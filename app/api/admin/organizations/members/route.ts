import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { APIError } from "better-auth";
import { isSystemAdmin, isSuperAdmin } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("org");

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 },
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSystemAdmin(session.user.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Admin can only view members of orgs they own
  if (!isSuperAdmin(session.user.role)) {
    const ownership = await prisma.member.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: "owner",
      },
    });
    if (!ownership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  try {
    const members = await auth.api.listMembers({
      headers: await headers(),
      query: {
        organizationId,
        limit: 100,
        offset: 0,
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to list members" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const { organizationId } = await req.json();

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization ID is required" },
      { status: 400 },
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const members = await auth.api.listMembers({
      headers: await headers(),
      query: {
        organizationId,
        limit: 100,
        offset: 0,
      },
    });

    if (members.members.length) {
      if (
        members.members.some(
          (member) =>
            member.user.id === session.user.id && member.role === "owner",
        )
      ) {
        return NextResponse.json({ data: true });
      }
    }
    return NextResponse.json({ data: false });
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to list members" },
      { status: 500 },
    );
  }
}
