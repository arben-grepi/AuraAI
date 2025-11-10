import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UserInfo from "@/components/auth/user-info";
import UserOrgs from "@/components/admin/user-orgs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Uploader } from "@/components/upload";
import prisma from "@/lib/prisma";

export default async function Home() {
  console.log(`[Home Page] Home page accessed`);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    console.log(`[Home Page] No session found, redirecting to /sign-in`);
    redirect("/sign-in");
  }

  console.log(
    `[Home Page] Session found - User ID: ${session.user.id}, Role: ${session.user.role}`,
  );

  // If user is admin, show admin dashboard
  if (session.user.role === "admin") {
    console.log(`[Home Page] Admin user detected, showing admin dashboard`);
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

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: {
        select: { slug: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const slug = membership?.organization?.slug;

  if (slug) {
    console.log(
      `[Home Page] Redirecting non-admin to org chat: /org/${slug}/chat`,
    );
    redirect(`/org/${slug}/chat`);
  }

  console.log(
    `[Home Page] Non-admin user has no org memberships, showing onboarding message`,
  );

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        You are not a member of any organization yet. Please contact your
        administrator.
      </p>
    </div>
  );
}
