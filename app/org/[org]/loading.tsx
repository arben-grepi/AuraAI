import { Loader } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <Loader className="size-4 animate-spin" />
    </div>
  );
}
