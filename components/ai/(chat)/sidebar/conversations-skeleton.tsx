import { SidebarMenuButton } from "@/components/ui/sidebar";
import { SidebarMenuItem } from "@/components/ui/sidebar";

export function ConversationsSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <SidebarMenuItem className="animate-pulse" key={index}>
          <SidebarMenuButton asChild key={index}>
            <div key={index} className="h-8 w-full rounded-md bg-muted"></div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );
}
