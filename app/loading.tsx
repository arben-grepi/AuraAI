import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        Redirecting you to your org chat...
      </p>
    </div>
  );
}

