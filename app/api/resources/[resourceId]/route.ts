import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isSystemAdmin } from "@/lib/auth-utils";

/**
 * GET /api/resources/[resourceId]
 *
 * Returns the full text of a resource for the source panel.
 * Auth: user must be a member of the resource's organization.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const { resourceId } = await params;

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      name: true,
      fullText: true,
      mimeType: true,
      organizationId: true,
    },
  });

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  // Verify the user is a member of the resource's organization
  if (resource.organizationId) {
    if (!isSystemAdmin(session.user.role)) {
      const membership = await prisma.member.findFirst({
        where: {
          organizationId: resource.organizationId,
          userId: session.user.id,
        },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  return NextResponse.json({
    id: resource.id,
    name: resource.name,
    fullText: resource.fullText ?? null,
    mimeType: resource.mimeType ?? null,
  });
}
