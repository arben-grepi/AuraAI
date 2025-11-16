"use client";

import { deleteConversation } from "@/lib/actions";
import { DropdownMenuItem } from "../ui/dropdown-menu";
import { useConversations } from "@/hooks/use-conversations";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";

export function DeleteConvo({ id, slug }: { id: string; slug: string }) {
  const { invalidateConversations } = useConversations();
  const router = useRouter();
  const pathname = usePathname();

  const handleDelete = async () => {
    const { success, data, error } = await deleteConversation(id);
    if (success) {
      toast.success(data?.data || "Conversation deleted");
      invalidateConversations();
      router.refresh();
      // Perform a full refresh of the page

      // Redirect if we're currently viewing the deleted conversation
      if (pathname === `/org/${slug}/chat/${id}`) {
        router.push(`/org/${slug}/chat`);
      }
    } else {
      toast.error(error || "Failed to delete conversation");
    }
  };

  return <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>;
}
