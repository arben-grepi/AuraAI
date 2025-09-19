import { Conversation } from "@/app/generated/prisma";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import Link from "next/link";
import { DeleteConvo } from "./delete-convo";
import { headers } from "next/headers";

export async function Conversations() {
  const incoming = await headers();
  const h = new Headers(incoming);

  const convos = await fetch(
    `${process.env.BETTER_AUTH_URL}/api/ai/conversations`,
    {
      next: {
        tags: ["conversations"],
      },
      headers: h,
    },
  );
  const data = await convos.json();

  return (
    <>
      {data.length > 0 ? (
        data.map((convo: Conversation) => (
          <div className="w-full" key={convo.id}>
            <ConversationItem conversation={convo} />
          </div>
        ))
      ) : (
        <SidebarMenuItem>
          <SidebarMenuButton disabled>
            <p>No conversations found</p>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    </>
  );
}

const ConversationItem = ({ conversation }: { conversation: Conversation }) => {
  return (
    <div className="w-full flex justify-between items-center hover:bg-sidebar-accent py-0.5 px-1 rounded-sm cursor-pointer">
      <Link href={`/chat/${conversation.id}`}>{conversation.title}</Link>
      <DeleteConvo />
    </div>
  );
};
