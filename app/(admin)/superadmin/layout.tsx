import { SuperadminSidebar } from "@/components/superadmin/superadmin-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isSuperAdmin } from "@/lib/auth-utils";
import { notFound } from "next/navigation";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !isSuperAdmin(session.user.role)) {
    notFound();
  }

  const name = session.user.name;
  const email = session.user.email;
  const userId = session.user.id;

  return (
    <div className="bg-zinc-50">
      <SidebarProvider>
        <SuperadminSidebar userId={userId} name={name} email={email} />
        <main className="w-full">{children}</main>
      </SidebarProvider>
    </div>
  );
}
