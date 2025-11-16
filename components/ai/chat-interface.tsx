"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { ArrowDown, LogOut, MessageCircleDashed } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useConversations } from "@/hooks/use-conversations";
import { ChatHeader } from "./chat-header";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChatInput } from "./chat-input";
import { Message } from "./message";
import type {
  ChatFilePart,
  ChatMessage,
  StoredChatMessage,
  UploadedAttachment,
} from "./types";
import { toChatMessage } from "./types";
import { Organization } from "@/lib/types";
import { auth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { Button } from "../ui/button";
interface ChatInterfaceProps {
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
  const { invalidateConversations } = useConversations();
  const router = useRouter();
  const [convId, setConvId] = useState<string | undefined>(
    conversationId || undefined,
  );
  const [isAnonymous, setIsAnonymous] = useState(false);
  const anonymousConvIdRef = useRef<string | undefined>(undefined);

  // Generate a temporary conversation ID for anonymous mode
  useEffect(() => {
    if (isAnonymous) {
      // Always ensure we have an anonymous ID when in anonymous mode
      if (!anonymousConvIdRef.current) {
        anonymousConvIdRef.current = uuidv4();
      }
      // Clear conversationId and navigate to base chat route when entering anonymous mode
      if (convId) {
        setConvId(undefined);
        window.history.replaceState({}, "", `/org/${slug}/chat`);
      }
    } else {
      anonymousConvIdRef.current = undefined;
    }
  }, [isAnonymous, convId, slug]);

  // Ensure anonymous ID is generated immediately when isAnonymous becomes true
  // This ensures the transport always has a valid ID
  const getAnonymousId = useCallback(() => {
    if (isAnonymous && !anonymousConvIdRef.current) {
      anonymousConvIdRef.current = uuidv4();
    }
    return anonymousConvIdRef.current || "anonymous-temp";
  }, [isAnonymous]);

  const pendingMessageRef = useRef<{
    text?: string;
    attachments: UploadedAttachment[];
  } | null>(null);

  useEffect(() => {
    // Don't set conversationId if we're in anonymous mode
    if (isAnonymous) {
      return;
    }
    if (conversationId && conversationId !== convId) {
      setConvId(conversationId);
    }
  }, [conversationId, convId, isAnonymous]);

  const transport = useMemo(() => {
    // Use temporary ID for anonymous mode, or actual convId for normal mode
    // Ensure we always have a valid ID for anonymous mode
    const conversationIdForApi = isAnonymous ? getAnonymousId() : convId;

    // Ensure isAnonymous is explicitly boolean true when in anonymous mode
    const body = {
      conversationId: conversationIdForApi,
      isAnonymous: isAnonymous === true,
    };

    return new DefaultChatTransport({
      api: "/api/ai/chat",
      body,
    });
  }, [convId, isAnonymous, getAnonymousId]);

  const { messages, setMessages, sendMessage, status, stop } =
    useChat<ChatMessage>({
      id: isAnonymous ? anonymousConvIdRef.current : convId,
      transport,
      onFinish: invalidateConversations,
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const handleSendMessage = useCallback(
    async ({
      text,
      attachments,
    }: {
      text?: string;
      attachments: UploadedAttachment[];
    }) => {
      const trimmedText = text?.trim();

      if (!trimmedText && attachments.length === 0) return;

      const send = async () => {
        const fileParts = attachments.length
          ? attachmentsToChatFileParts(attachments)
          : undefined;

        const payload:
          | { text: string; files?: ChatFilePart[] }
          | { files: ChatFilePart[] }
          | undefined = (() => {
          if (fileParts?.length && trimmedText) {
            return { text: trimmedText, files: fileParts };
          }
          if (fileParts?.length) {
            return { files: fileParts };
          }
          if (trimmedText) {
            return { text: trimmedText };
          }
          return undefined;
        })();

        if (!payload) return;

        await sendMessage(payload as Parameters<typeof sendMessage>[0]);
      };

      if (!convId && !isAnonymous) {
        const newId = uuidv4();
        pendingMessageRef.current = {
          text: trimmedText,
          attachments: [...attachments],
        };
        setConvId(newId);
        window.history.replaceState({}, "", `/org/${slug}/chat/${newId}`);
        return;
      }

      await send();
    },
    [convId, sendMessage, slug, isAnonymous],
  );

  useEffect(() => {
    if (convId && pendingMessageRef.current) {
      const pending = pendingMessageRef.current;
      pendingMessageRef.current = null;
      void handleSendMessage(pending);
    }
  }, [convId, handleSendMessage]);

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["messages", convId],
    queryFn: async () => {
      const response = await fetch(
        `/api/ai/chat/messages?conversationId=${convId}`,
      );
      const data: StoredChatMessage[] = await response.json();

      return data.map((msg) => toChatMessage(msg));
    },
    enabled: !!convId && !isAnonymous,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (initialMessages?.length) {
      setMessages(initialMessages);
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
        for (const m of unique) {
          if (!seen.has(m.id)) merged.push(m);
        }
        return merged;
      });
    }
  }, [convId, messagesData, setMessages]);

  function stopRequest() {
    stop();
  }

  const waitingForAssistant =
    status === "submitted" &&
    messages[messages.length - 1]?.role !== "assistant";

  if (isLoading && convId && !isAnonymous) {
    return (
      <div className="mx-auto flex flex-col overflow-hidden w-full h-screen relative">
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
                  <AnimatePresence mode="popLayout"></AnimatePresence>
                </div>
              </StickToBottom.Content>
              <ScrollToBottom />
            </div>
            <AnimatePresence>
              <ScrollToBottom />
            </AnimatePresence>
          </StickToBottom>
        </div>

        <div className="w-full bg-linear-to-t from-white dark:from-background from-80% to-transparent">
          <div className="max-w-3xl mx-auto w-full">
            <ChatInput
              isAnonymous={isAnonymous}
              loading={status === "streaming" || status === "submitted"}
              onSend={handleSendMessage}
              onStop={stopRequest}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col overflow-hidden w-full h-screen relative">
      <ChatHeader />
      <div className="flex-1 relative overflow-hidden">
        <StickToBottom
          className="h-full w-full"
          resize="smooth"
          initial="smooth"
        >
          <div
            className={`relative w-full flex flex-col overflow-hidden h-full min-w-0 bg-background`}
          >
            <StickToBottom.Content className="flex flex-col gap-6  scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 scrollbar-thumb-rounded-full min-w-0">
              <div
                className={`w-full h-[80px] mb-4 flex items-center justify-center sticky top-0 z-10 backdrop-blur`}
              >
                <AnimatePresence mode="wait">
                  {isAnonymous ? (
                    <div className="flex gap-2">
                      <motion.p
                        className="text-xs font-medium text-zinc-800 ml-2"
                        key="temp-header"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        layout
                      >
                        Temporary chat
                      </motion.p>
                    </div>
                  ) : (
                    <motion.div
                      className="flex gap-2"
                      key="anon-header"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      layout
                    >
                      <Image
                        src={organization?.logo || "/logo.svg"}
                        alt={organization?.name || "Organization Logo"}
                        width={70}
                        height={70}
                        className="rounded-sm object-cover"
                      />
                      <p className="text-xs font-medium text-zinc-800 ml-2">
                        {organization?.name}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="absolute right-5 top-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <div className="rounded-full border cursor-pointer border-zinc-300 p-5 w-[42px] h-[42px] bg-zinc-100 flex items-center justify-center">
                        {session?.user.name?.charAt(0)}
                        {session?.user.name
                          .split(" ")
                          .slice(1)
                          .at(0)
                          ?.charAt(0)}
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem>
                        <LogOut className="size-4" />
                        <p
                          onClick={() => {
                            void signOut();
                            router.push("/sign-in");
                          }}
                          className="text-sm cursor-pointer"
                        >
                          Logout
                        </p>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="absolute right-18 top-3">
                  <Button
                    className="cursor-pointer rounded-full border-zinc-300 p-5 w-[42px] h-[42px] bg-zinc-100 flex items-center justify-center"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newValue = !isAnonymous;
                      setIsAnonymous(newValue);
                      if (newValue && convId) {
                        setConvId(undefined);
                        window.history.replaceState(
                          {},
                          "",
                          `/org/${slug}/chat`,
                        );
                      }
                    }}
                    disabled={!!conversationId}
                    title={
                      isAnonymous
                        ? "Anonymous mode: ON - Click to disable"
                        : "Anonymous mode: OFF - Click to enable"
                    }
                  >
                    <MessageCircleDashed className="size-4 cursor-pointer" />
                  </Button>
                </div>
              </div>
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
                    <Message
                      key="assistant-thinking"
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

      <div className="w-full bg-linear-to-t from-white dark:from-background from-80% to-transparent">
        <div className="max-w-3xl mx-auto w-full">
          <ChatInput
            isAnonymous={isAnonymous}
            loading={status === "streaming" || status === "submitted"}
            onSend={handleSendMessage}
            onStop={stopRequest}
          />
        </div>
      </div>
    </div>
  );
}

function attachmentsToChatFileParts(
  attachments: UploadedAttachment[],
): ChatFilePart[] {
  return attachments.map((attachment) => {
    const kommunMetadata: Record<string, string | number | null> = {
      storageProvider: "s3",
      size: attachment.size,
    };

    if (attachment.objectKey) {
      kommunMetadata.objectKey = attachment.objectKey;
    }

    if (attachment.organizationId !== undefined) {
      kommunMetadata.organizationId = attachment.organizationId ?? null;
    }

    const providerMetadata = {
      kommun: kommunMetadata,
    };

    return {
      type: "file",
      mediaType: attachment.mediaType || "application/octet-stream",
      filename: attachment.name,
      url: attachment.url,
      providerMetadata,
    } satisfies ChatFilePart;
  });
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
