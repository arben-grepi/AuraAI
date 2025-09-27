import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen w-[100%]">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}
