"use client";

import { StickToBottom } from "use-stick-to-bottom";
import { ScrollToBottom } from "./scroll-to-bottom";
import { ChatInput } from "./chat-input";
import type { UploadedAttachment } from "./types";

const scrollAreaClassName =
  "flex flex-col gap-6 bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 scrollbar-thumb-rounded-full min-w-0";

export interface ChatLayoutProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  isAnonymous: boolean;
  loading: boolean;
  onSend: (params: {
    text?: string;
    attachments: UploadedAttachment[];
  }) => Promise<void>;
  onStop: () => void;
}

export function ChatLayout({
  header,
  children,
  isAnonymous,
  loading,
  onSend,
  onStop,
}: ChatLayoutProps) {
  return (
    <div className="mx-auto flex flex-col overflow-hidden w-full h-screen relative">
      {header}
      <div className="flex-1 relative overflow-hidden">
        <StickToBottom
          className="h-full w-full"
          resize="smooth"
          initial="smooth"
        >
          <div className="relative w-full flex flex-col overflow-hidden h-full min-w-0 bg-background">
            <StickToBottom.Content
              className={`flex flex-col gap-6 ${scrollAreaClassName}`}
            >
              {children}
            </StickToBottom.Content>
            <ScrollToBottom />
          </div>
          <ScrollToBottom />
        </StickToBottom>
      </div>

      <div className="w-full bg-linear-to-t from-white dark:from-background from-80% to-transparent">
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput
            isAnonymous={isAnonymous}
            loading={loading}
            onSend={onSend}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}
