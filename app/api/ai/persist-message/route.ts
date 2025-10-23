import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const { conversationId, role, content, parts } = payload;

    if (!conversationId || !role || !content) {
      return new Response("Missing required fields", { status: 400 });
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
