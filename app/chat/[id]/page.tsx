import { ChatInterface } from "@/components/ai/chat-interface";
import { toChatMessage } from "@/components/ai/types";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page(props: PageProps<"/chat/[id]">) {
  const { id } = await props.params;
  const session = await auth.api.getSession({ headers: await headers() });

  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      conversation: { userId: session?.user.id },
    },
    orderBy: { createdAt: "asc" },
  });

  const initialMessages = messages.map((msg) =>
    toChatMessage({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      parts: msg.parts,
      createdAt: msg.createdAt.toISOString(),
    }),
  );

  return (
    <div className="flex items-center justify-center min-h-screen w-[100%]">
      <ChatInterface conversationId={id} initialMessages={initialMessages} />
    </div>
  );
}
