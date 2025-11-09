import { ChatInterface } from "@/components/ai/chat-interface";

export default async function Page(props: PageProps<"/org/[org]">) {
  const { org } = await props.params;

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <ChatInterface conversationId="" slug={org} />
    </div>
  );
}
