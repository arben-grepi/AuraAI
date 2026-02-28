"use client";

import { LayoutDashboard, Building2, ShieldCheck, Users } from "lucide-react";
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
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { NavUser } from "@/components/sidebar/nav-user";

const items = [
  { title: "Dashboard", url: "/superadmin", icon: LayoutDashboard },
  { title: "Organizations", url: "/superadmin/organizations", icon: Building2 },
  { title: "Admins", url: "/superadmin/admins", icon: ShieldCheck },
  { title: "Users", url: "/superadmin/users", icon: Users },
];

export function SuperadminSidebar({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Sidebar className="border-zinc-200">
      <SidebarContent className="bg-zinc-50 flex flex-col justify-between h-full">
        <div>
          <SidebarHeader className="flex justify-between py-4 px-2">
            <div className="flex gap-1">
              <Image src="/logo.svg" alt="Logo" width={32} height={32} />
              <div>
                <p className="text-sm font-medium">Superadmin</p>
                <p className="text-xs font-medium text-zinc-400">
                  Platform Management
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarGroupLabel className="font-medium">
                  NAVIGATION
                </SidebarGroupLabel>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      className="hover:bg-zinc-100 transition-all duration-200"
                      asChild
                      isActive={pathname === item.url}
                    >
                      <div
                        role="button"
                        className="cursor-pointer"
                        onClick={() => router.push(item.url)}
                      >
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
        <SidebarFooter className="justify-end p-4">
          <NavUser userId={userId} name={name} email={email} avatar="/avatar.png" />
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
