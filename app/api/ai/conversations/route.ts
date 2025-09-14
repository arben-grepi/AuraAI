import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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
