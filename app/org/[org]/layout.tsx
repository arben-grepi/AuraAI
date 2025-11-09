import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  console.log(org);
  return (
    <SidebarProvider>
      <AppSidebar org={org} />
      <main className="w-full">{children}</main>
    </SidebarProvider>
  );
}
