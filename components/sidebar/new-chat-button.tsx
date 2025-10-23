"use client";

import { createConversation } from "@/lib/actions";
import { useConversations } from "@/hooks/use-conversations";
import { Button } from "../ui/button";
import { SidebarMenuButton } from "../ui/sidebar";
import { SidebarMenuItem } from "../ui/sidebar";
import { toast } from "sonner";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function NewChatButton() {
  const { invalidateConversations } = useConversations();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreateConversation = async () => {
    startTransition(async () => {
      const { success, data, error } = await createConversation();
      if (success) {
        invalidateConversations();
        toast.success(data?.data || "Conversation created");
        router.push(`/chat/${data?.id}`);
      } else {
        toast.error(error || "Failed to create conversation");
      }
    });
  };

  return (
    <SidebarMenuItem className="">
      <SidebarMenuButton asChild>
        <Button
          className="cursor-pointer w-full"
          onClick={handleCreateConversation}
          disabled={isPending}
        >
          {isPending ? "Creating..." : "New Chat"}
        </Button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
