import { useQueryClient } from "@tanstack/react-query";

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

  const setConversationsData = (data: any) => {
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
