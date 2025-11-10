"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface HomeRedirectProps {
  redirectTo: string;
}

export function HomeRedirect({ redirectTo }: HomeRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(redirectTo);
  }, [redirectTo, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4">
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">
        Redirecting you to your org chat...
      </p>
    </div>
  );
}

