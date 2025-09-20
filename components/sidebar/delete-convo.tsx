"use client";

import { deleteConversation } from "@/lib/actions";
import { DropdownMenuItem } from "../ui/dropdown-menu";
import { useConversations } from "@/hooks/use-conversations";
import { toast } from "sonner";

export function DeleteConvo({ id }: { id: string }) {
  const { invalidateConversations } = useConversations();

  const handleDelete = async () => {
    const result = await deleteConversation(id);
    if (result.success) {
      toast.success("Conversation deleted");
      invalidateConversations();
    } else {
      toast.error(result.message);
    }
  };

  return <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>;
}
