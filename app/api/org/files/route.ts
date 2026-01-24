import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  // Verify user has access to this organization
  if (session.user.role !== "admin") {
    const membership = await prisma.member.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [folders, resources] = await Promise.all([
    prisma.fileFolder.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.resource.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, tags: true, fileFolderId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rootFiles = resources
    .filter((r) => !r.fileFolderId)
    .map(({ id, name, tags }) => ({ id, name, tags }));

  const foldersWithResources = folders.map((f) => ({
    id: f.id,
    name: f.name,
    resources: resources
      .filter((r) => r.fileFolderId === f.id)
      .map(({ id, name, tags }) => ({ id, name, tags })),
  }));

  return NextResponse.json({ folders: foldersWithResources, rootFiles });
}
