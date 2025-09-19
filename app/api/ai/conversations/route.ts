import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidateTag, revalidatePath } from "next/cache";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  console.log("Session from conversations route:", session);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!conversations) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(conversations);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title }: { title?: string } = await req.json().catch(() => ({}));

  const created = await prisma.conversation.create({
    data: {
      title: title && title.trim().length > 0 ? title.trim() : "New chat",
      userId: session.user.id,
    },
  });

  revalidateTag("conversations");
  revalidatePath(`/chat`);

  return NextResponse.json(
    { id: created.id, title: created.title },
    { status: 201 },
  );
}
