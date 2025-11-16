import { ChatInterface } from "@/components/ai/chat-interface";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Organization } from "@/lib/types";

export default async function Page(props: PageProps<"/org/[org]/chat">) {
  const { org } = await props.params;

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

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <ChatInterface
        conversationId=""
        slug={org}
        organization={organization}
        session={session}
      />
    </div>
  );
}
