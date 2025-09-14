import { ChatInterface } from "@/components/ai/chat-interface";

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-screen w-[100%]">
      <ChatInterface conversationId="" />
    </div>
  );
}
