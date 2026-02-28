"use client";

import { OrgSidebar } from "@/components/org-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const url = usePathname();
  const orgSlug = url.split("/")[3] ?? "";
  const decodedOrgSlug = decodeURIComponent(orgSlug);

  return (
    <div className="bg-zinc-50">
      <SidebarProvider>
        <OrgSidebar name={decodedOrgSlug} />
        <main className="w-full relative">
          {children}
          <Link
            href={`/org/${encodeURIComponent(decodedOrgSlug)}/chat`}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button size="lg" className="gap-2 shadow-lg">
              <MessageSquare className="size-4" />
              Open Chat
            </Button>
          </Link>
        </main>
      </SidebarProvider>
    </div>
  );
}
