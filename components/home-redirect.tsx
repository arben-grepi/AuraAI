"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function HomeRedirect() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    async function redirectToOrg() {
      try {
        console.log(`[HomeRedirect] Fetching user's first org`);
        const response = await fetch("/api/user/first-org", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          console.error(
            `[HomeRedirect] API returned ${response.status}: ${response.statusText}`,
          );
          setIsRedirecting(false);
          return;
        }

        const data = await response.json();
        console.log(`[HomeRedirect] API response:`, data);

        if (data?.slug) {
          console.log(
            `[HomeRedirect] Redirecting to org chat: /org/${data.slug}/chat`,
          );
          router.replace(`/org/${data.slug}/chat`);
        } else {
          console.log(`[HomeRedirect] No org found, staying on home page`);
          setIsRedirecting(false);
        }
      } catch (error) {
        console.error(`[HomeRedirect] Error fetching org:`, error);
        setIsRedirecting(false);
      }
    }

    redirectToOrg();
  }, [router]);

  if (!isRedirecting) {
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
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4">
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">
        Redirecting you to your org chat...
      </p>
    </div>
  );
}
