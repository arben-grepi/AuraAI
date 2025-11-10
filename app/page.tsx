import UserInfo from "@/components/auth/user-info";
import UserOrgs from "@/components/admin/user-orgs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Uploader } from "@/components/upload";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function HomeContent() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.role !== "admin") {
    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          select: { slug: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (membership?.organization?.slug) {
      redirect(`/org/${membership.organization.slug}/chat`);
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          You are not a member of any organization yet. Please contact your
          administrator.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserInfo />
        <Uploader />
        <UserOrgs />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            Redirecting you to your org chat...
          </p>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
