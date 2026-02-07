"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQuery } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { useConversations } from "@/hooks/use-conversations";
import { attachmentsToChatFileParts } from "@/components/ai/(chat)/chat-utils";
import type {
  ChatFilePart,
  ChatMessage,
  StoredChatMessage,
  UploadedAttachment,
} from "@/components/ai/(chat)/types";
import { toChatMessage } from "@/components/ai/(chat)/types";

export interface UseChatInterfaceParams {
  conversationId: string;
  initialMessages?: ChatMessage[];
  slug: string | null;
}

export interface UseChatInterfaceResult {
  messages: ChatMessage[];
  status: "streaming" | "submitted" | "ready" | "error";
  convId: string | undefined;
  setConvId: (id: string | undefined) => void;
  isAnonymous: boolean;
  setIsAnonymous: (value: boolean) => void;
  handleSendMessage: (params: {
    text?: string;
    attachments: UploadedAttachment[];
  }) => Promise<void>;
  stopRequest: () => void;
  waitingForAssistant: boolean;
  isLoadingMessages: boolean;
}

export function useChatInterface({
  conversationId,
  initialMessages,
  slug,
}: UseChatInterfaceParams): UseChatInterfaceResult {
  const { invalidateConversations } = useConversations();
  const [convId, setConvId] = useState<string | undefined>(
    conversationId || undefined,
  );
  const [isAnonymous, setIsAnonymous] = useState(false);
  const anonymousConvIdRef = useRef<string | undefined>(undefined);
  const pendingMessageRef = useRef<{
    text?: string;
    attachments: UploadedAttachment[];
  } | null>(null);

  useEffect(() => {
    if (isAnonymous) {
      if (!anonymousConvIdRef.current) {
        anonymousConvIdRef.current = uuidv4();
      }
      if (convId) {
        setConvId(undefined);
        window.history.replaceState({}, "", `/org/${slug}/chat`);
      }
    } else {
      anonymousConvIdRef.current = undefined;
    }
  }, [isAnonymous, convId, slug]);

  const getAnonymousId = useCallback(() => {
    if (isAnonymous && !anonymousConvIdRef.current) {
      anonymousConvIdRef.current = uuidv4();
    }
    return anonymousConvIdRef.current || "anonymous-temp";
  }, [isAnonymous]);

  useEffect(() => {
    if (isAnonymous) return;
    if (conversationId && conversationId !== convId) {
      setConvId(conversationId);
    }
  }, [conversationId, convId, isAnonymous]);

  const transport = useMemo(() => {
    const conversationIdForApi = isAnonymous ? getAnonymousId() : convId;
    return new DefaultChatTransport({
      api: "/api/ai/chat",
      body: {
        conversationId: conversationIdForApi,
        isAnonymous: isAnonymous === true,
      },
    });
  }, [convId, isAnonymous, getAnonymousId]);

  const { messages, setMessages, sendMessage, status, stop } =
    useChat<ChatMessage>({
      id: isAnonymous ? anonymousConvIdRef.current : convId,
      transport,
      onFinish: invalidateConversations,
      onError: (error) => toast.error(error.message),
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

      const buildPayload = (): { text: string; files?: ChatFilePart[] } | { files: ChatFilePart[] } | undefined => {
        const fileParts = attachments.length
          ? attachmentsToChatFileParts(attachments)
          : undefined;
        if (fileParts?.length && trimmedText) return { text: trimmedText, files: fileParts };
        if (fileParts?.length) return { files: fileParts };
        if (trimmedText) return { text: trimmedText };
        return undefined;
      };

      const payload = buildPayload();
      if (!payload) return;

      const doSend = () => sendMessage(payload as Parameters<typeof sendMessage>[0]);

      if (!convId && !isAnonymous) {
        const newId = uuidv4();
        pendingMessageRef.current = { text: trimmedText, attachments: [...attachments] };
        setConvId(newId);
        window.history.replaceState({}, "", `/org/${slug}/chat/${newId}`);
        return;
      }

      await doSend();
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

  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
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
    if (initialMessages?.length) setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  useEffect(() => {
    if (convId && messagesData?.length) {
      const unique = messagesData.filter(
        (m, i, arr) => i === arr.findIndex((x) => x.id === m.id),
      );
      setMessages((current) => {
        const seen = new Set(current.map((m) => m.id));
        const merged = [...current];
        for (const m of unique) {
          if (!seen.has(m.id)) merged.push(m);
        }
        return merged;
      });
    }
  }, [convId, messagesData, setMessages]);

  const waitingForAssistant =
    status === "submitted" && messages[messages.length - 1]?.role !== "assistant";

  return {
    messages,
    status,
    convId,
    setConvId,
    isAnonymous,
    setIsAnonymous,
    handleSendMessage,
    stopRequest: stop,
    waitingForAssistant,
    isLoadingMessages,
  };
}
