"use client";

import { ChatInput } from "./chat-input";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Message } from "./message";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { ArrowDown, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export function ChatInterface() {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
    }),
  });

  function addMessage(message: string) {
    sendMessage({ text: message });
  }

  function stopRequest() {
    stop();
  }

  return (
    <div className="mx-auto border border-border rounded-lg flex flex-col overflow-hidden w-[100%] h-screen">
      <div className="flex-1 relative overflow-hidden">
        <StickToBottom
          className="h-full w-full"
          resize="smooth"
          initial="smooth"
        >
          <div className="relative w-full flex flex-col overflow-hidden h-full">
            <StickToBottom.Content className="flex flex-col gap-6 p-4 bg-background scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 scrollbar-thumb-rounded-full">
              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => (
                  <Message
                    key={message.id}
                    message={message.parts
                      .map((part) => (part.type === "text" ? part.text : ""))
                      .join("")}
                    variant={message.role === "user" ? "user" : "assistant"}
                    isStreaming={
                      message.role === "assistant" &&
                      status === "streaming" &&
                      index === messages.length - 1
                    }
                  />
                ))}
              </AnimatePresence>
              {status === "submitted" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-center"
                >
                  <Loader2 className="size-4 text-foreground group-hover:text-muted-foreground animate-spin" />
                </motion.div>
              )}
            </StickToBottom.Content>
            <ScrollToBottom />
          </div>
          <AnimatePresence>
            <ScrollToBottom />
          </AnimatePresence>
        </StickToBottom>
      </div>

      <div className="flex-shrink-0">
        <ChatInput
          loading={status === "streaming" || status === "submitted"}
          addMessage={addMessage}
          onStop={stopRequest}
        />
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
          className="absolute bottom-4 left-1/2 cursor-pointer transform -translate-x-1/2 z-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-2 shadow-lg"
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
