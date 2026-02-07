import { SidebarTrigger } from "../../ui/sidebar";
import Image from "next/image";

export function ChatHeader() {
  return (
    <div className="flex items-center justify-between absolute top-0 left-0 right-0 bg-background z-50 p-4 md:hidden border-b border-border shadow-sm">
      <SidebarTrigger />
      <Image src="/logo.svg" alt="Axiom" width={20} height={20} />
    </div>
  );
}
