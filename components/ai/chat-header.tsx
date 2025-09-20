import { SidebarTrigger } from "../ui/sidebar";

export function ChatHeader() {
  return (
    <div className="flex items-center justify-between absolute top-0 left-0 right-0 bg-background z-50 p-4 md:hidden">
      <SidebarTrigger />
    </div>
  );
}
