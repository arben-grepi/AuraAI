import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { normalizeSlugParam } from "@/lib/utils";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org: orgRaw } = await params;
  const org = normalizeSlugParam(orgRaw);
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    redirect("/sign-in");
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: org },
    select: { id: true },
  });

  if (!organization) {
    redirect("/");
  }

  if (session.user.role !== "admin") {
    const membership = await prisma.member.findFirst({
      where: {
        organizationId: organization.id,
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (!membership) {
      redirect("/");
    }
  }

  if (session.session?.activeOrganizationId !== organization.id) {
    await auth.api.setActiveOrganization({
      headers: requestHeaders,
      body: { organizationId: organization.id },
    });
  }

  return (
    <SidebarProvider>
      <AppSidebar org={org} />
      <main className="w-full">{children}</main>
    </SidebarProvider>
  );
}
