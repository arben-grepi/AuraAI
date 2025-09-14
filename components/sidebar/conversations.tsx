import { Conversation } from "@/app/generated/prisma";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import Link from "next/link";

export async function Conversations() {
  const convos = await fetch(`http://localhost:3000/api/ai/conversations`, {
    next: {
      tags: ["conversations"],
      revalidate: 60,
    },
  });
  const data = await convos.json();

  return (
    <>
      {data.length > 0 ? (
        data.map((convo: Conversation) => (
          <SidebarMenuItem key={convo.id}>
            <SidebarMenuButton asChild>
              <Link href={`/chat/${convo.id}`}>{convo.title}</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
