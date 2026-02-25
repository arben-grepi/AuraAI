"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { ChatHeader } from "./chat-header";
import { ChatLayout } from "./chat-layout";
import { ChatHeaderStrip } from "./chat-header-strip";
import { Message } from "./message";
import { SourcePanel } from "./source-panel";
import type { SourcePanelState } from "./source-panel";
import { useChatInterface } from "@/hooks/use-chat-interface";
import { auth } from "@/lib/auth";
import type { ChatMessage, CitationInfo } from "./types";
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

  const [sourcePanelState, setSourcePanelState] =
    useState<SourcePanelState | null>(null);

  const handleCitationClick = useCallback((citation: CitationInfo) => {
    if (!citation.resourceId) return;
    setSourcePanelState({
      open: true,
      resourceId: citation.resourceId,
      resourceName: citation.name,
      startOffset: citation.startOffset,
      endOffset: citation.endOffset,
    });
  }, []);

  const handleCloseSourcePanel = useCallback(() => {
    setSourcePanelState(null);
  }, []);

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
              onCitationClick={handleCitationClick}
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
    <>
      <ChatLayout
        header={<ChatHeader />}
        isAnonymous={isAnonymous}
        loading={loading}
        onSend={handleSendMessage}
        onStop={stopRequest}
      >
        {showLoadingState ? null : content}
      </ChatLayout>

      <SourcePanel state={sourcePanelState} onClose={handleCloseSourcePanel} />
    </>
  );
}
