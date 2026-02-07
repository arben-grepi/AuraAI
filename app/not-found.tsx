"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function NotFound() {
  const router = useRouter();
  return (
    <div className="flex items-center flex-col space-y-4 justify-center min-h-screen w-full">
      <h1 className="text-2xl font-bold">Not Found</h1>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link href="/" className="text-sm text-muted-foreground">
        Go back to the home page
      </Link>
      <Button variant="outline" onClick={() => router.back()}>
        Go back
      </Button>
    </div>
  );
}
