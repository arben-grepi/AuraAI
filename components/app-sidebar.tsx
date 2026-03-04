import { Loader, PenLine, Search } from "lucide-react";
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Conversations } from "./ai/(chat)/sidebar/conversations";
import { Suspense } from "react";
import { ConversationsSkeleton } from "./ai/(chat)/sidebar/conversations-skeleton";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/auth-utils";
import { AiSettingsDialog } from "./org/ai-settings-dialog";
import { ScrollArea } from "./ui/scroll-area";
import { NavUser } from "./sidebar/nav-user";

export async function AppSidebar({ org }: { org: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const organization = await prisma.organization.findFirst({
    where: {
      slug: org,
      ...(isSystemAdmin(session?.user.role)
        ? {}
        : { members: { some: { userId: session?.user.id ?? "" } } }),
    },
  });

  if (!organization) {
    return null;
  }

  let isOrgAdmin = false;
  if (isSystemAdmin(session?.user.role)) {
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
      title: "Ny chatt",
      url: `/org/${org}/chat`,
      icon: PenLine,
    },
    {
      title: "Sök chatt",
      url: "/search",
      icon: Search,
      variant: "white" as const,
    },
  ];

  return (
    <Sidebar className="border-none">
      <SidebarContent className="overflow-hidden">
        <SidebarHeader className="flex shrink-0 flex-row justify-between items-center">
          <div
            className="w-full h-12 rounded-[12px] bg-white shadow-sm border border-zinc-200 flex items-center justify-between px-2 py-4"
            style={{
              backgroundImage: `linear-gradient(to bottom, transparent, ${organization?.backgroundColor || ""})`,
            }}
          >
            <div className="flex gap-4">
              {!organization ? (
                <div className="w-[60px] h-[60px] rounded-[6px] bg-zinc-200 flex items-center justify-center">
                  <Loader className="size-4 animate-spin" />
                </div>
              ) : (
                <div className="relative size-[60px] shrink-0 overflow-hidden rounded-[6px]">
                  <Image
                    src={organization?.logo || ""}
                    alt={organization?.name || ""}
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              <div className="flex flex-col justify-center text-left gap-1">
                <p className="text-sm font-medium text-zinc-800">
                  {organization?.name}
                </p>
                <p className="text-xs font-medium text-zinc-500">
                  Organisation
                </p>
              </div>
            </div>
            {isOrgAdmin && <AiSettingsDialog orgSlug={org} />}
          </div>
        </SidebarHeader>
        <SidebarGroup className="min-h-0 flex-1 flex flex-col">
          <SidebarGroupContent className="min-h-0 flex-1 flex flex-col">
            <SidebarMenu className="min-h-0 flex-1 flex flex-col">
              {items.map((item) => (
                <SidebarMenuItem key={item.title} className="shrink-0">
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
              <SidebarGroupLabel className="shrink-0">Chattar</SidebarGroupLabel>
              <ScrollArea className="min-h-0 min-w-0 flex-1 overflow-x-hidden">
                <div className="flex min-h-full min-w-0 w-full flex-col">
                  <div className="min-w-0 flex-1 flex flex-col">
                    <Suspense fallback={<ConversationsSkeleton />}>
                      <Conversations slug={org} />
                    </Suspense>
                  </div>
                </div>
              </ScrollArea>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarFooter>
          <NavUser
            userId={session?.user.id ?? ""}
            name={session?.user.name ?? ""}
            email={session?.user.email ?? ""}
            avatar={session?.user.image ?? ""}
            role={session?.user.role ?? ""}
          />
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
