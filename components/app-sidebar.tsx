import { Calendar, Home, Inbox, Search, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "./ui/button";
import { Conversations } from "./sidebar/conversations";
import { Suspense } from "react";
import { ConversationsSkeleton } from "./sidebar/conversations-skeleton";
import { NavUser } from "./sidebar/nav-user";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createConversation } from "@/lib/actions";

const items = [
  {
    title: "Home",
    url: "#",
    icon: Home,
  },
  {
    title: "Inbox",
    url: "#",
    icon: Inbox,
  },
  {
    title: "Calendar",
    url: "#",
    icon: Calendar,
  },
  {
    title: "Search",
    url: "#",
    icon: Search,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
];

export async function AppSidebar() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { name, email, image } = session?.user || {};

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem className="my-2">
                <SidebarMenuButton asChild>
                  <Button
                    onClick={createConversation}
                    className="cursor-pointer w-full"
                  >
                    New Chat
                  </Button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <Suspense fallback={<ConversationsSkeleton />}>
                <Conversations />
              </Suspense>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser name={name || ""} email={email || ""} avatar={image || ""} />
      </SidebarFooter>
    </Sidebar>
  );
}
