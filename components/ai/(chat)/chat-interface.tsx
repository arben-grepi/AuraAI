"use client";

import { useRef, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { ChatHeader } from "./chat-header";
import { ChatLayout } from "./chat-layout";
import type { ChatLayoutHandle } from "./chat-layout";
import { ChatHeaderStrip } from "./chat-header-strip";
import { Message } from "./message";
import { useChatInterface } from "@/hooks/use-chat-interface";
import { auth } from "@/lib/auth";
import type { ChatMessage } from "./types";
import type { Organization } from "@/lib/types";

export interface ChatInterfaceProps {
  conversationId: string;
  initialMessages?: ChatMessage[];
  slug: string | null;
  organization: Organization;
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
}

export function ChatInterface({
  conversationId,
  initialMessages,
  slug,
  organization,
  session,
}: ChatInterfaceProps) {
  const {
    messages,
    status,
    convId,
    isAnonymous,
    setIsAnonymous,
    handleSendMessage,
    stopRequest,
    waitingForAssistant,
    isLoadingMessages,
  } = useChatInterface({ conversationId, initialMessages, slug });

  const chatLayoutRef = useRef<ChatLayoutHandle>(null);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      chatLayoutRef.current?.focusInput();
    }
    prevStatusRef.current = status;
  }, [status]);

  const loading = status === "streaming" || status === "submitted";
  const showLoadingState = isLoadingMessages && convId && !isAnonymous;

  const content = (
    <>
      <ChatHeaderStrip
        isAnonymous={isAnonymous}
        onAnonymousChange={setIsAnonymous}
        organization={organization}
        session={session}
        conversationId={conversationId}
      />
      <div className="max-w-3xl mx-auto w-full">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <Message
              key={message.id}
              message={message}
              variant={message.role === "user" ? "user" : "assistant"}
              isStreaming={
                message.role === "assistant" &&
                status === "streaming" &&
                index === messages.length - 1
              }
            />
          ))}
          {waitingForAssistant && (
            <Message key="assistant-thinking" variant="assistant" submitted />
          )}
        </AnimatePresence>
      </div>
    </>
  );

  return (
    <ChatLayout
      ref={chatLayoutRef}
      header={<ChatHeader />}
      isAnonymous={isAnonymous}
      loading={loading}
      onSend={handleSendMessage}
      onStop={stopRequest}
    >
      {showLoadingState ? null : content}
    </ChatLayout>
  );
}
