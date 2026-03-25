import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { InlineSignOutButton } from "@/components/auth/inline-sign-out-button";

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

  // Note: Admin users are redirected to /admin in middleware, so this page only handles non-admin users

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <p className="text-sm text-muted-foreground text-center">
        You are not a member of any organization yet. Please contact your
        administrator.
      </p>
      <InlineSignOutButton />
    </div>
  );
}
