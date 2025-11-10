import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import UserInfo from "@/components/auth/user-info";
import UserOrgs from "@/components/admin/user-orgs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Uploader } from "@/components/upload";
import { HomeRedirect } from "@/components/home-redirect";

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

  // For non-admin users, client-side redirect will handle it
  console.log(
    `[Home Page] Non-admin user on home page - client will redirect to org chat`,
  );
  return <HomeRedirect />;
}
