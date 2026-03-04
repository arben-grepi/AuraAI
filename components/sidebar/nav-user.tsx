"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  Settings,
} from "lucide-react";
import BoringAvatar from "boring-avatars";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { SignOutButton } from "../auth/sign-out-button";
import { isSuperAdmin } from "@/lib/auth-utils";
import { useRouter } from "next/navigation";

export function NavUser({
  userId,
  name,
  email,
  avatar,
  role,
}: {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  role?: string;
}) {
  const { isMobile } = useSidebar();
  const avatarSeed = userId || email || name || "user";
  const router = useRouter();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-full">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-full p-0 bg-transparent">
                  <BoringAvatar
                    size={32}
                    name={avatarSeed}
                    variant="pixel"
                    square={false}
                  />
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-full p-0 bg-transparent">
                    <BoringAvatar
                      size={32}
                      name={avatarSeed}
                      variant="pixel"
                      square={false}
                    />
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <BadgeCheck />
                Konto
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CreditCard />
                Fakturering
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Bell />
                Notiser
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {isSuperAdmin(role) && (
              <DropdownMenuItem
                onClick={() => router.push("/superadmin")}
                className="cursor-pointer"
              >
                <Settings />
                Superadmin-panel
              </DropdownMenuItem>
            )}
            <SignOutButton />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
