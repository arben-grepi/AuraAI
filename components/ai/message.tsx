import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import { CopyToClipboard } from "./copy-to-clipboard";
import { MarkdownContent } from "./markdown-content";
import type { ChatFilePart, ChatMessage, ChatMessagePart, ChatTextPart } from "./types";

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
  "flex flex-col gap-3 max-w-full sm:max-w-[80%] min-w-0 rounded-3xl px-5 py-4 text-base",
  {
    variants: {
      variant: {
        user: "items-end bg-card text-card-foreground leading-6 font-normal bg-zinc-50",
        assistant:
          "items-start text-card-foreground leading-relaxed font-normal",
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
}

function Message({
  className,
  variant,
  message,
  isStreaming = false,
  submitted = false,
  ...props
}: MessageProps) {
  const resolvedVariant = variant ?? (message?.role === "user" ? "user" : "assistant");

  const textParts = React.useMemo(() => getTextParts(message), [message]);
  const textContent = textParts.map((part) => part.text).join("");
  const fileParts = React.useMemo(() => getFileParts(message), [message]);

  const showThinking =
    resolvedVariant === "assistant" && submitted && !textContent.trim() && fileParts.length === 0;

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
      <motion.div
        className={cn(messageContentVariants({ variant: resolvedVariant }))}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {resolvedVariant === "assistant" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex flex-col gap-3"
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
                {fileParts.length > 0 && (
                  <AttachmentGallery files={fileParts} variant={resolvedVariant} />
                )}
                {textContent.trim().length > 0 && (
                  <>
                    <MarkdownContent content={textContent} />
                    <CopyToClipboard text={textContent} />
                  </>
                )}
                {isStreaming && (
                  <motion.span
                    className="inline-block w-2 h-2 bg-primary ml-1 rounded-full"
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
            className="flex flex-col gap-3 whitespace-pre-wrap text-right"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {fileParts.length > 0 && (
              <AttachmentGallery files={fileParts} variant={resolvedVariant} />
            )}
            {textContent.trim().length > 0 && textContent}
          </motion.div>
        )}
      </motion.div>
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
            <a
              key={key}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block overflow-hidden rounded-xl border",
                variant === "user"
                  ? "border-white/70 shadow-sm"
                  : "border-border bg-muted/40",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.url}
                alt={file.filename ?? "Attachment"}
                className="h-32 w-32 object-cover"
              />
            </a>
          );
        }

        return (
          <a
            key={key}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            download={file.filename}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
              variant === "user"
                ? "border-white/70 bg-white/90 text-foreground shadow-sm"
                : "border-border bg-muted/30",
            )}
          >
            <span className="font-medium truncate max-w-[140px]">
              {file.filename ?? "Attachment"}
            </span>
          </a>
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

function isTextPart(part: ChatMessagePart): part is ChatTextPart {
  return part.type === "text";
}

function isFilePart(part: ChatMessagePart): part is ChatFilePart {
  return part.type === "file";
}

export { Message, messageVariants, messageContentVariants };
