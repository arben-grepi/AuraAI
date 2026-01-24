import { PenLine, Search } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { AiSettingsDialog } from "./org/ai-settings-dialog";

export async function AppSidebar({ org }: { org: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const organization = await prisma.organization.findFirst({
    where: {
      slug: org,
      ...(session?.user.role === "admin"
        ? {}
        : { members: { some: { userId: session?.user.id ?? "" } } }),
    },
  });

  if (!organization) {
    return null;
  }

  // Check if user is admin or owner of the organization
  let isOrgAdmin = false;
  if (session?.user.role === "admin") {
    isOrgAdmin = true;
  } else {
    const membership = await prisma.member.findFirst({
      where: {
        organizationId: organization.id,
        userId: session?.user.id ?? "",
      },
      select: {
        role: true,
      },
    });

    isOrgAdmin = membership?.role === "owner" || membership?.role === "admin";
  }

  const items = [
    {
      title: "New Chat",
      url: `/org/${org}/chat`,
      icon: PenLine,
    },
    {
      title: "Search Chats",
      url: "/search",
      icon: Search,
      variant: "white" as const,
    },
  ];

  return (
    <Sidebar className="border-none">
      <SidebarContent>
        <SidebarHeader className="flex flex-row justify-between items-center ">
          <div
            className="w-full h-12 rounded-[12px] border border-zinc-200 flex items-center justify-between px-2 py-4"
            style={{
              backgroundImage: `linear-gradient(to bottom, transparent, ${organization?.backgroundColor || ""})`,
            }}
          >
            <div className="flex items-center gap-2">
              {!organization ? (
                <div>Loading...</div>
              ) : (
                <Image
                  src={organization?.logo || ""}
                  alt={organization?.name || ""}
                  width={34}
                  height={34}
                  className="block rounded-[6px] aspect-square object-cover"
                />
              )}
              <p className="text-sm font-medium text-zinc-800 ml-2">
                {organization?.name}
              </p>
            </div>
            {isOrgAdmin && <AiSettingsDialog orgSlug={org} />}
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
      {/* <SidebarFooter>
        <NavUser name={name || ""} email={email || ""} avatar={image || ""} />
      </SidebarFooter> */}
    </Sidebar>
  );
}
