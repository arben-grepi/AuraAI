import { useQueryClient } from "@tanstack/react-query";
import { Conversation } from "@/app/generated/prisma";

export function useConversations() {
  const queryClient = useQueryClient();

  const invalidateConversations = () => {
    queryClient.invalidateQueries({
      queryKey: ["conversations"],
    });
  };

  const refetchConversations = () => {
    queryClient.refetchQueries({
      queryKey: ["conversations"],
    });
  };

  const setConversationsData = (data: Conversation[]) => {
    queryClient.setQueryData(["conversations"], data);
  };

  const getConversationsData = () => {
    return queryClient.getQueryData(["conversations"]);
  };

  return {
    invalidateConversations,
    refetchConversations,
    setConversationsData,
    getConversationsData,
  };
}
