"use client";

import { deleteConversation } from "@/lib/actions";
import { DropdownMenuItem } from "../ui/dropdown-menu";
import { useConversations } from "@/hooks/use-conversations";
import { toast } from "sonner";

export function DeleteConvo({ id }: { id: string }) {
  const { invalidateConversations } = useConversations();

  const handleDelete = async () => {
    const { success, data, error } = await deleteConversation(id);
    if (success) {
      toast.success(data?.data || "Conversation deleted");
      invalidateConversations();
    } else {
      toast.error(error || "Failed to delete conversation");
    }
  };

  return <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>;
}
