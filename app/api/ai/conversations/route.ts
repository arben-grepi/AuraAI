import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { revalidateTag, revalidatePath } from "next/cache";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const conversations = await prisma.conversation.findMany({
    where: {
      userId: session?.user.id,
    },
  });

  if (!conversations) {
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(conversations);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
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
  revalidatePath(`/chat/${created.id}`);

  return NextResponse.json(
    { id: created.id, title: created.title },
    { status: 201 },
  );
}
