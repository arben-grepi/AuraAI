"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function InlineSignOutButton({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className}
      disabled={isLoading}
      onClick={async () => {
        setIsLoading(true);
        await signOut({
          fetchOptions: {
            onSuccess: () => router.push("/sign-in"),
          },
        });
        setIsLoading(false);
      }}
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut className="size-4" />
    </Button>
  );
}

