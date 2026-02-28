import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { normalizeSlugParam } from "@/lib/utils";
import { notFound } from "next/navigation";
import { isSystemAdmin } from "@/lib/auth-utils";

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
    notFound();
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: org },
      select: { id: true },
    });
    if (!organization) {
      notFound();
    }
    if (!isSystemAdmin(session.user.role)) {
      const membership = await prisma.member.findFirst({
        where: {
          organizationId: organization.id,
          userId: session.user.id,
        },
        select: { id: true },
      });

      if (!membership) {
        notFound();
      }
    }

    if (session.session?.activeOrganizationId !== organization.id) {
      await auth.api.setActiveOrganization({
        headers: requestHeaders,
        body: { organizationId: organization.id },
      });
    }
  } catch (error) {
    console.log(error);
    notFound();
  }

  return (
    <SidebarProvider>
      <AppSidebar org={org} />
      <main className="w-full">{children}</main>
    </SidebarProvider>
  );
}
