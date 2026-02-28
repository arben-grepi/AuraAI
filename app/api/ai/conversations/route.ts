import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import { isSystemAdmin } from "@/lib/auth-utils";
import { withMetrics } from "@/lib/with-metrics";

async function handleGet(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = session.session?.activeOrganizationId;

  if (!organizationId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  if (!isSystemAdmin(session.user.role)) {
    const membership = await prisma.member.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const [chatFolders, conversations] = await Promise.all([
    prisma.chatFolder.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.conversation.findMany({
      where: {
        userId: session.user.id,
        organizationId,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rootConversations = conversations.filter((c) => !c.chatFolderId);
  const foldersWithConversations = chatFolders.map((f) => ({
    id: f.id,
    name: f.name,
    conversations: conversations
      .filter((c) => c.chatFolderId === f.id)
      .map(({ id, title, createdAt, updatedAt }) => ({
        id,
        title,
        createdAt,
        updatedAt,
      })),
  }));

  return NextResponse.json({
    folders: foldersWithConversations,
    rootConversations: rootConversations.map(
      ({ id, title, createdAt, updatedAt }) => ({
        id,
        title,
        createdAt,
        updatedAt,
      }),
    ),
  });
}

async function handlePost(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = session.session?.activeOrganizationId;

  if (!organizationId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  if (!isSystemAdmin(session.user.role)) {
    const membership = await prisma.member.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const { title, chatFolderId }: { title?: string; chatFolderId?: string | null } =
    body;

  if (chatFolderId) {
    const folder = await prisma.chatFolder.findFirst({
      where: { id: chatFolderId, organizationId },
    });
    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found or does not belong to this organization" },
        { status: 400 },
      );
    }
  }

  const created = await prisma.conversation.create({
    data: {
      title: title && title.trim().length > 0 ? title.trim() : "New chat",
      userId: session.user.id,
      organizationId,
      chatFolderId: chatFolderId || undefined,
    },
  });

  revalidateTag("conversations");

  return NextResponse.json(
    { id: created.id, title: created.title },
    { status: 201 },
  );
}

export const GET = withMetrics(handleGet);
export const POST = withMetrics(handlePost);
