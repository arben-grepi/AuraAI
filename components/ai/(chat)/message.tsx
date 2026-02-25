import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import { CopyToClipboard } from "./copy-to-clipboard";
import { MarkdownContent } from "./markdown-content";
import type {
  ChatFilePart,
  ChatMessage,
  ChatMessagePart,
  ChatTextPart,
  ChatToolInvocationPart,
} from "./types";
import { File, Cloud } from "lucide-react";

const messageVariants = cva("flex w-full min-w-0 mb-4", {
  variants: {
    variant: {
      user: "justify-end",
      assistant: "justify-start",
    },
  },
  defaultVariants: {
    variant: "assistant",
  },
});

const messageContentVariants = cva(
  "flex flex-col max-w-full sm:max-w-[80%] min-w-0 overflow-x-hidden rounded-2xl px-4 py-3 text-base break-words",
  {
    variants: {
      variant: {
        user: "items-end bg-card text-card-foreground leading-6 font-normal bg-zinc-50 whitespace-pre-wrap",
        assistant: "items-start text-card-foreground leading-6 font-normal",
      },
    },
    defaultVariants: {
      variant: "assistant",
    },
  },
);

export interface MessageProps
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      | "onAnimationStart"
      | "onAnimationEnd"
      | "onAnimationIteration"
      | "onDrag"
      | "onDragEnd"
      | "onDragStart"
      | "onTouchStart"
      | "onTouchEnd"
      | "onTouchMove"
      | "onPointerDown"
      | "onPointerUp"
      | "onPointerMove"
      | "onPointerCancel"
      | "onPointerEnter"
      | "onPointerLeave"
    >,
    VariantProps<typeof messageVariants> {
  message?: ChatMessage;
  isStreaming?: boolean;
  submitted?: boolean;
  onCitationClick?: (citation: import("./types").CitationInfo) => void;
}

function Message({
  className,
  variant,
  message,
  isStreaming = false,
  submitted = false,
  onCitationClick,
  ...props
}: MessageProps) {
  const resolvedVariant =
    variant ?? (message?.role === "user" ? "user" : "assistant");

  const textParts = React.useMemo(() => getTextParts(message), [message]);
  const textContent = textParts.map((part) => part.text).join("\n\n");
  const fileParts = React.useMemo(() => getFileParts(message), [message]);
  const toolParts = React.useMemo(
    () => getToolInvocationParts(message),
    [message],
  );

  const showThinking =
    resolvedVariant === "assistant" &&
    (submitted || isStreaming) &&
    !textContent.trim() &&
    fileParts.length === 0 &&
    toolParts.length === 0;

  if (!message && !submitted) {
    return null;
  }

  return (
    <motion.div
      className={cn(messageVariants({ variant: resolvedVariant, className }))}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
        delay: resolvedVariant === "user" ? 0.1 : 0.2,
      }}
      {...props}
    >
      <div
        className={cn(
          "flex flex-col gap-2 w-full",
          resolvedVariant === "user" ? "items-end" : "items-start",
        )}
      >
        {fileParts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-wrap gap-2"
          >
            <AttachmentGallery files={fileParts} variant={resolvedVariant} />
          </motion.div>
        )}

        {resolvedVariant === "assistant" &&
          (toolParts.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-1.5"
              aria-label="Tool calls"
            >
              {toolParts.map((part) => (
                <ToolPartStatusLine key={part.toolCallId} part={part} />
              ))}
            </motion.div>
          ) : (
            isStreaming &&
            !textContent.trim() && <ToolPartStatusLinePlaceholder />
          ))}

        {(textContent.trim().length > 0 || showThinking) && (
          <motion.div
            className={cn(messageContentVariants({ variant: resolvedVariant }))}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {resolvedVariant === "assistant" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                {showThinking ? (
                  <motion.div
                    className="flex items-center gap-2 text-muted-foreground animate-pulse"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex gap-2">
                      <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-0"></div>
                      <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-100"></div>
                      <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-200"></div>
                    </div>
                    <span className="text-sm animate-pulse">Thinking...</span>
                  </motion.div>
                ) : (
                  <>
                    {textContent.trim().length > 0 && (
                      <>
                        <MarkdownContent
                          content={textContent}
                          citations={
                            (
                              message?.metadata as
                                | {
                                    citations?: Record<
                                      string,
                                      import("./types").CitationInfo
                                    >;
                                  }
                                | undefined
                            )?.citations
                          }
                          onCitationClick={onCitationClick}
                        />
                        <CopyToClipboard text={textContent} />
                      </>
                    )}
                    {isStreaming && (
                      <motion.span
                        className="inline-block w-2 h-2 bg-primary ml-1 rounded-2xl"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                className="w-full text-left"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                {textContent.trim().length > 0 && (
                  <span className="block whitespace-pre-wrap wrap-break-words">
                    {textContent}
                  </span>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function AttachmentGallery({
  files,
  variant,
}: {
  files: ChatFilePart[];
  variant: "user" | "assistant";
}) {
  return (
    <div className="flex flex-wrap gap-2" data-no-open>
      {files.map((file, index) => {
        const key = `${file.filename ?? file.url}-${index}`;
        const isImage = file.mediaType?.startsWith("image/");

        if (isImage) {
          return (
            <div
              key={key}
              className="overflow-hidden rounded-2xl border border-border shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.filename ?? "Attachment"}
                className="h-40 w-40 object-cover"
              />
            </div>
          );
        }

        return (
          <div
            key={key}
            className={cn(
              "flex items-start gap-2 rounded-xl border px-2 py-2 text-sm",
              variant === "user"
                ? "border-white/70 bg-white/90 text-foreground shadow-sm"
                : "border-border bg-muted/30",
            )}
          >
            <div className="bg-neutral-100 rounded-[6px] p-2 shrink-0">
              <File className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-medium truncate max-w-[140px]">
                {file.filename ?? "Attachment"}
              </span>
              <span className="text-xs text-muted-foreground">{file.type}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getTextParts(message?: ChatMessage): ChatTextPart[] {
  if (!message) return [];
  return message.parts.filter(isTextPart);
}

function getFileParts(message?: ChatMessage): ChatFilePart[] {
  if (!message) return [];
  return message.parts.filter(isFilePart);
}

function getToolInvocationParts(
  message?: ChatMessage,
): ChatToolInvocationPart[] {
  if (!message) return [];
  return message.parts.filter(isToolInvocationPart) as ChatToolInvocationPart[];
}

function isTextPart(part: ChatMessagePart): part is ChatTextPart {
  return part.type === "text";
}

function isFilePart(part: ChatMessagePart): part is ChatFilePart {
  return part.type === "file";
}

function isToolInvocationPart(
  part: ChatMessagePart,
): part is ChatToolInvocationPart {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    (String((part as { type: string }).type).startsWith("tool-") ||
      (part as { type: string }).type === "dynamic-tool")
  );
}

function getToolCallingStatusLabel(
  toolName: string,
  state: string,
  _input?: unknown,
): string {
  const isCalling = state === "input-streaming" || state === "input-available";
  if (!isCalling) return toolName;

  switch (toolName) {
    case "retrieve_context":
      return "Searching through files…";
    default:
      return `Calling ${toolName}…`;
  }
}

function ToolPartStatusLinePlaceholder() {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
        "border-primary/30 bg-primary/10 text-primary animate-pulse",
      )}
      role="status"
      aria-live="polite"
    >
      <Cloud className="h-3 w-3 shrink-0" aria-hidden />
      <span>Processing…</span>
    </div>
  );
}

const TOOL_FINISHED_HIDE_DELAY_MS = 3000;

function ToolPartStatusLine({ part }: { part: ChatToolInvocationPart }) {
  const [hideFinished, setHideFinished] = React.useState(false);
  const isFinished = part.state === "output-available";

  React.useEffect(() => {
    if (!isFinished) {
      setHideFinished(false);
      return;
    }
    const timeoutId = setTimeout(() => {
      setHideFinished(true);
    }, TOOL_FINISHED_HIDE_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [isFinished, part.toolCallId]);

  if (isFinished && hideFinished) {
    return null;
  }

  const toolName =
    part.type === "dynamic-tool"
      ? ((part as { toolName?: string }).toolName ?? "tool")
      : String(part.type).replace(/^tool-/, "");

  const content = (() => {
    switch (part.state) {
      case "input-streaming":
        return (
          <span className="animate-pulse">
            {getToolCallingStatusLabel(toolName, part.state, part.input)}
          </span>
        );
      case "input-available":
        return (
          <span className="animate-pulse">
            {getToolCallingStatusLabel(toolName, part.state, part.input)}
          </span>
        );
      case "output-available":
        return (
          <>
            <span>Finished</span>
          </>
        );
      case "output-error":
        return (
          <span className="text-destructive">
            Error{part.errorText ? `: ${part.errorText}` : ""}
          </span>
        );
      default:
        return (
          <span>
            {getToolCallingStatusLabel(toolName, part.state, part.input)}
          </span>
        );
    }
  })();

  return (
    <motion.div
      className="flex items-center gap-2 text-muted-foreground animate-pulse"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-2">
        <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-0"></div>
        <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-100"></div>
        <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-200"></div>
      </div>
      <span className="text-sm animate-pulse">{content}</span>
    </motion.div>
  );
}


export { Message, messageVariants, messageContentVariants };
