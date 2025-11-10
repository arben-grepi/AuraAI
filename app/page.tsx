import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UserInfo from "@/components/auth/user-info";
import UserOrgs from "@/components/admin/user-orgs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Uploader } from "@/components/upload";

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

  // For non-admin users, middleware will redirect to org chat
  // This page should rarely be seen, but show a loading state just in case
  console.log(
    `[Home Page] Non-admin user on home page - showing redirect message (middleware should have redirected)`,
  );
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4">
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Redirecting...</p>
    </div>
  );
}
