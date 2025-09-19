import { Trash } from "lucide-react";
import { Button } from "../ui/button";

export function DeleteConvo() {
  return (
    <Button
      className="hover:bg-red-500 hover:text-white"
      variant="ghost"
      size="icon"
    >
      <Trash />
    </Button>
  );
}
