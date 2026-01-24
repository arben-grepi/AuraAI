import { ChatInterface } from "@/components/ai/chat-interface";
import { toChatMessage } from "@/components/ai/types";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Organization } from "@/lib/types";
import { normalizeSlugParam } from "@/lib/utils";

export default async function Page(
  props: PageProps<"/org/[org]/chat/[conversationId]">,
) {
  const { org: orgRaw, conversationId } = await props.params;
  const org = normalizeSlugParam(orgRaw);
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    notFound();
  }

  const organization: Organization | null =
    (await prisma.organization.findUnique({
      where: { slug: org },
    })) as Organization | null;

  if (!organization) {
    notFound();
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId: session.user.id,
      organizationId: organization.id,
    },
    select: { id: true },
  });

  if (!conversation) {
    notFound();
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
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
    <div className="flex items-center justify-center min-h-screen w-full">
      <ChatInterface
        conversationId={conversation.id}
        initialMessages={initialMessages}
        slug={organization?.slug}
        organization={organization}
        session={session}
      />
    </div>
  );
}
