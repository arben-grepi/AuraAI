"use client";

import { createConversation } from "@/lib/actions";
import { useConversations } from "@/hooks/use-conversations";
import { useTransition } from "react";

interface NewChatFormProps {
  children: React.ReactNode;
}

export function NewChatForm({ children }: NewChatFormProps) {
  const { invalidateConversations } = useConversations();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await createConversation(formData);
      // Invalidate conversations cache after server action completes
      invalidateConversations();
    });
  };

  return <form action={handleSubmit}>{children}</form>;
}
