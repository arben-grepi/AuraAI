import { useQueryClient } from "@tanstack/react-query";
import { Conversation } from "@/app/generated/prisma";

export function useConversationsAdvanced() {
  const queryClient = useQueryClient();

  // Method 1: Invalidate queries (triggers refetch)
  const invalidateConversations = () => {
    queryClient.invalidateQueries({
      queryKey: ["conversations"],
    });
  };

  // Method 2: Refetch queries (immediate refetch)
  const refetchConversations = () => {
    queryClient.refetchQueries({
      queryKey: ["conversations"],
    });
  };

  // Method 3: Set query data directly (optimistic update)
  const addConversationOptimistically = (newConversation: Conversation) => {
    queryClient.setQueryData(
      ["conversations"],
      (oldData: Conversation[] | undefined) => {
        if (!oldData) return [newConversation];
        return [newConversation, ...oldData];
      },
    );
  };

  // Method 4: Update query data with a function
  const updateConversations = (
    updater: (oldData: Conversation[] | undefined) => Conversation[],
  ) => {
    queryClient.setQueryData(["conversations"], updater);
  };

  // Method 5: Remove a conversation from cache
  const removeConversation = (conversationId: string) => {
    queryClient.setQueryData(
      ["conversations"],
      (oldData: Conversation[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter((conv) => conv.id !== conversationId);
      },
    );
  };

  // Method 6: Get current data without triggering a fetch
  const getCurrentConversations = (): Conversation[] | undefined => {
    return queryClient.getQueryData(["conversations"]);
  };

  // Method 7: Prefetch conversations (useful for loading data before it's needed)
  const prefetchConversations = async () => {
    await queryClient.prefetchQuery({
      queryKey: ["conversations"],
      queryFn: async () => {
        const response = await fetch(
          "http://localhost:3000/api/ai/conversations",
        );
        return response.json();
      },
      staleTime: 1000 * 60 * 5,
    });
  };

  // Method 8: Reset queries (clears cache and refetches)
  const resetConversations = () => {
    queryClient.resetQueries({
      queryKey: ["conversations"],
    });
  };

  // Method 9: Cancel ongoing requests
  const cancelConversationsRequests = () => {
    queryClient.cancelQueries({
      queryKey: ["conversations"],
    });
  };

  return {
    // Basic methods
    invalidateConversations,
    refetchConversations,
    getCurrentConversations,

    // Advanced methods
    addConversationOptimistically,
    updateConversations,
    removeConversation,
    prefetchConversations,
    resetConversations,
    cancelConversationsRequests,
  };
}
