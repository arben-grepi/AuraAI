import { PenLine, Search } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Conversations } from "./sidebar/conversations";
import { Suspense } from "react";
import { ConversationsSkeleton } from "./sidebar/conversations-skeleton";
import { NavUser } from "./sidebar/nav-user";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Image from "next/image";
import prisma from "@/lib/prisma";

const items = [
  {
    title: "New Chat",
    url: "/",
    icon: PenLine,
  },
  {
    title: "Search Chats",
    url: "/search",
    icon: Search,
    variant: "white",
  },
];

export async function AppSidebar({ org }: { org: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { name, email, image } = session?.user || {};

  const organization = await prisma.organization.findUnique({
    where: {
      slug: org,
    },
  });

  console.log(organization);

  return (
    <Sidebar className="border-none">
      <SidebarContent>
        <SidebarHeader className="flex flex-row justify-between items-center ">
          <div
            className="w-full h-12"
            style={{ backgroundColor: organization?.backgroundColor || "" }}
          >
            {!organization ? (
              <div>Loading...</div>
            ) : (
              <Image
                src={organization?.logo || ""}
                alt={organization?.name || ""}
                width={54}
                height={54}
                className="block"
              />
            )}
          </div>
        </SidebarHeader>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    className={`${item.variant === "white" ? "bg-white shadow-sm" : ""}`}
                    asChild
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarGroupLabel>Chats</SidebarGroupLabel>
              <Suspense fallback={<ConversationsSkeleton />}>
                <Conversations slug={org} />
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
