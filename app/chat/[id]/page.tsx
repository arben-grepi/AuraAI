import { ChatInterface } from "@/components/ai/chat-interface";
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

  const initialMessages = messages.map((msg) => {
    const rawParts = msg.parts as unknown as Array<{
      type: string;
      text?: string;
    }> | null;
    const parts =
      Array.isArray(rawParts) && rawParts.length > 0
        ? rawParts.map((p) =>
            p && p.type === "text"
              ? { type: "text" as const, text: p.text ?? "" }
              : { type: "text" as const, text: "" },
          )
        : [{ type: "text" as const, text: msg.content }];

    return {
      id: msg.id,
      role: msg.role === "user" ? "user" : "assistant",
      parts,
    } as {
      id: string;
      role: "user" | "assistant";
      parts: Array<{ type: "text"; text: string }>;
    };
  });

  return (
    <div className="flex items-center justify-center min-h-screen w-[100%]">
      <ChatInterface conversationId={id} initialMessages={initialMessages} />
    </div>
  );
}
