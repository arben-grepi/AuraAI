import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const { conversationId, role, content, parts } = payload;

    if (!conversationId || !role || !content) {
      return new Response("Missing required fields", { status: 400 });
    }

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const organizationId = session.session?.activeOrganizationId;

    if (!organizationId) {
      return new Response("No active organization", { status: 400 });
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
