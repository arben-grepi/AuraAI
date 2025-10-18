"use client";

import { ChatInput } from "./chat-input";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Message } from "./message";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { ArrowDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConversations } from "@/hooks/use-conversations";
import { ChatHeader } from "./chat-header";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

interface ChatInterfaceProps {
  conversationId: string;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    parts: Array<{ type: string; text: string }>;
    createdAt?: string;
  }>;
}

export function ChatInterface({
  conversationId,
  initialMessages,
}: ChatInterfaceProps) {
  const { invalidateConversations } = useConversations();

  const [convId, setConvId] = useState<string | undefined>(
    conversationId || undefined,
  );

  const pendingMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (conversationId && conversationId !== convId) {
      setConvId(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    id: convId,
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: { conversationId: convId },
    }),
    onFinish: invalidateConversations,
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (convId && pendingMessageRef.current) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      sendMessage({ text: msg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["messages", convId],
    queryFn: async () => {
      const response = await fetch(
        `/api/ai/chat/messages?conversationId=${convId}`,
      );
      const data = await response.json();

      const formatted = data.map(
        (msg: {
          id: string;
          role: string;
          content: string;
          parts?: Array<{ type: string; text: string }>;
          createdAt: string;
        }) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          parts: msg.parts || [{ type: "text", text: msg.content }],
          createdAt: msg.createdAt,
        }),
      );

      return formatted;
    },
    enabled: !!convId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (initialMessages?.length) {
      setMessages(initialMessages as unknown as typeof messages);
    }
  }, [initialMessages, setMessages]);

  useEffect(() => {
    if (convId && messagesData?.length) {
      const unique = messagesData.filter(
        (m: { id: string }, i: number, arr: { id: string }[]) =>
          i === arr.findIndex((x) => x.id === m.id),
      );
      setMessages((current) => {
        const seen = new Set<string>(current.map((m) => m.id));
        const merged = [...current];
        for (const m of unique as unknown as typeof current) {
          if (!seen.has(m.id)) merged.push(m);
        }
        return merged;
      });
    }
  }, [convId, messagesData, setMessages]);

  function addMessage(message: string) {
    async function ensureConversationAndSend() {
      if (!convId) {
        const newId = uuidv4();
        pendingMessageRef.current = message;
        setConvId(newId);
        window.history.replaceState({}, "", `/chat/${newId}`);
        return;
      }
      sendMessage({ text: message });
    }
    ensureConversationAndSend();
  }

  function stopRequest() {
    stop();
  }

  if (isLoading && convId) {
    return (
      <div className="mx-auto border border-border flex flex-col overflow-hidden w-[100%] h-screen">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-4 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col overflow-hidden w-[100%] h-screen relative">
      <ChatHeader />
      <div className="flex-1 relative overflow-hidden">
        <StickToBottom
          className="h-full w-full"
          resize="smooth"
          initial="smooth"
        >
          <div className="pt-4 relative w-full flex flex-col overflow-hidden h-full min-w-0">
            <StickToBottom.Content className="flex flex-col gap-6 bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 scrollbar-thumb-rounded-full min-w-0">
              <div className="max-w-3xl mx-auto w-full">
                <AnimatePresence mode="popLayout">
                  {messages.map((message, index) => (
                    <Message
                      key={message.id}
                      message={message.parts
                        .map((part) => (part.type === "text" ? part.text : ""))
                        .join("")}
                      variant={message.role === "user" ? "user" : "assistant"}
                      submitted={status === "submitted"}
                      isStreaming={
                        message.role === "assistant" &&
                        status === "streaming" &&
                        index === messages.length - 1
                      }
                    />
                  ))}
                  {status === "submitted" && (
                    <Message
                      key="assistant-thinking"
                      message=""
                      variant="assistant"
                      submitted
                    />
                  )}
                </AnimatePresence>
              </div>
            </StickToBottom.Content>
            <ScrollToBottom />
          </div>
          <AnimatePresence>
            <ScrollToBottom />
          </AnimatePresence>
        </StickToBottom>
      </div>

      <div className="w-full bg-gradient-to-t from-white dark:from-background from-80% to-transparent">
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput
            loading={status === "streaming" || status === "submitted"}
            addMessage={addMessage}
            onStop={stopRequest}
          />
        </div>
      </div>
    </div>
  );
}

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.button
          key="scroll-button"
          className="absolute bottom-8 left-1/2 cursor-pointer transform -translate-x-1/2 z-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-2 shadow-lg"
          onClick={() => scrollToBottom()}
          title="Scroll to bottom"
          initial={{ opacity: 0, y: 0, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 0, scale: 0.8 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowDown className="size-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
