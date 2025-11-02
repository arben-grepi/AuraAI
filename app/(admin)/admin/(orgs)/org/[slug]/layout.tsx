"use client";

import { OrgSidebar } from "@/components/org-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  const url = usePathname();
  const orgName = url.split("/")[2];

  return (
    <div className="bg-zinc-50">
      <SidebarProvider>
        <OrgSidebar name={orgName} />
        <main className="w-[100%]">{children}</main>
      </SidebarProvider>
    </div>
  );
}
