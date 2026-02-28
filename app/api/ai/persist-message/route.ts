import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isSystemAdmin } from "@/lib/auth-utils";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const { conversationId, role, content, parts } = payload;

    if (!conversationId || typeof conversationId !== "string") {
      return new Response("Conversation ID is required", { status: 400 });
    }

    if (!role || typeof role !== "string" || !["user", "assistant"].includes(role)) {
      return new Response("Invalid role. Must be 'user' or 'assistant'", { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return new Response("Content is required", { status: 400 });
    }

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const organizationId = session.session?.activeOrganizationId;

    if (!organizationId) {
      return new Response("No active organization", { status: 400 });
    }

    // Verify user has access to organization
    if (!isSystemAdmin(session.user.role)) {
      const membership = await prisma.member.findFirst({
        where: {
          organizationId,
          userId: session.user.id,
        },
        select: { id: true },
      });

      if (!membership) {
        return new Response("Unauthorized", { status: 403 });
      }
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
        organizationId,
      },
      select: { id: true },
    });

    if (!conversation) {
      return new Response("Conversation not found", { status: 404 });
    }

    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        parts: parts || [{ type: "text", text: content, state: "done" }],
      },
    });

    return new Response("Message persisted successfully", { status: 200 });
  } catch (error) {
    console.error("Error persisting message:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
