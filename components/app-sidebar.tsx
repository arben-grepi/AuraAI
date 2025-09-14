import { Calendar, Home, Inbox, Search, Settings } from "lucide-react";
import Form from "next/form";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { createConversation } from "@/lib/actions";
import { NavUser } from "./sidebar/nav-user";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="cursor-pointer">New Chat</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>New Chat</DialogTitle>
                        <DialogDescription>
                          Create a new chat with the AI.
                        </DialogDescription>
                        <Form action={createConversation}>
                          <Input
                            type="text"
                            name="title"
                            placeholder="Enter a title for your chat"
                          />
                          <Button type="submit">Create</Button>
                        </Form>
                      </DialogHeader>
                    </DialogContent>
                  </Dialog>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <Suspense fallback={<ConversationsSkeleton />}>
                <Conversations />
              </Suspense>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarFooter>
          <NavUser name={name || ""} email={email || ""} avatar={image || ""} />
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
