"use client";
import {
  Settings2,
  Sparkles,
  ChevronLeft,
  Users,
  LogOut,
  FileText,
} from "lucide-react";
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
import { useParams, useRouter, usePathname } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const items = [
  { title: "General", url: "", icon: Settings2 },
  { title: "AI customization", url: "ai", icon: Sparkles },
  { title: "Users", url: "users", icon: Users },
  { title: "Sources", url: "sources", icon: FileText },
];

export function OrgSidebar({ name }: { name: string }) {
  const unslugedName = name.replace(/-/g, " ");
  const router = useRouter();
  const { slug } = useParams();
  const pathname = usePathname();
  const activeItem = pathname.replace(`/admin/org/${slug}/`, "");

  return (
    <Sidebar className="border-zinc-200">
      <SidebarContent className="bg-zinc-50  flex flex-col justify-between h-full">
        <div>
          <SidebarHeader className="flex flex-row justify-between items-center pt-7">
            <div className="flex gap-2">
              <div
                onClick={router.back}
                className="rounded-full bg-transparent border border-zinc-200 w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-zinc-100 transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Admin Settings</p>
                <p className="text-xs font-medium text-zinc-400 capitalize">
                  {unslugedName}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarGroupLabel className="font-medium">
                  WORKSPACE
                </SidebarGroupLabel>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      className="hover:bg-zinc-100 transition-all duration-200"
                      asChild
                      isActive={activeItem === item.url}
                    >
                      <div
                        role="button"
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/admin/org/${slug}/${item.url}`)
                        }
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <SidebarMenuButton
                variant="outline"
                className="hover:bg-zinc-100 transition-all duration-200 w-full justify-start border border-zinc-200 py-2 px-4 cursor-pointer"
              >
                <LogOut className="size-4" />
                <span className="text-sm font-medium">Sign out</span>
              </SidebarMenuButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out</AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogDescription>
                Are you sure you want to sign out?
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() =>
                    signOut({
                      fetchOptions: {
                        onSuccess: () => {
                          router.push("/sign-in");
                        },
                      },
                    })
                  }
                >
                  Sign out
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
