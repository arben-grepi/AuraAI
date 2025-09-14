import { SidebarMenuButton } from "../ui/sidebar";
import { SidebarMenuItem } from "../ui/sidebar";

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
