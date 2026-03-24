"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { DropdownMenuItem } from "../ui/dropdown-menu";
import { Loader, LogOut } from "lucide-react";
import { useState } from "react";

export function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const handleClick = async () => {
    setIsLoading(true);
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
        },
      },
    });
    setIsLoading(false);
  };
  return (
    <DropdownMenuItem
      className="relative overflow-hidden cursor-pointer"
      onClick={handleClick}
    >
      <LogOut className="size-4" />
      Sign out
      {isLoading && (
        <div className="bg-neutral-300 absolute top-0 right-0 bottom-0 opacity-25 left-0 flex items-center justify-center pointer-events-none">
          <Loader className="size-4 animate-spin" />
        </div>
      )}
    </DropdownMenuItem>
  );
}
