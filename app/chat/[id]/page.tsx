import { ChatInterface } from "@/components/ai/chat-interface";

export default async function Page(props: PageProps<"/chat/[id]">) {
  const { id } = await props.params;

  return (
    <div className="flex items-center justify-center min-h-screen w-[100%]">
      <ChatInterface conversationId={id} />
    </div>
  );
}
