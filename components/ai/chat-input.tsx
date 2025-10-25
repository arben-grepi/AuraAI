"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, File as FileIcon, Plus, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

import { ChatUploaderWrapper } from "./chat-uploader-wrapper";

interface ChatInputProps {
  onSend: (payload: { text?: string; files: File[] }) => Promise<void> | void;
  loading: boolean;
  onStop?: () => void;
  className?: string;
}

interface ComposerAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

export function ChatInput({ onSend, loading, onStop, className }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<ComposerAttachment[]>([]);

  const canSubmit = message.trim().length > 0 || attachments.length > 0;

  const dropZoneClassName = useMemo(
    () =>
      cn(
        "flex items-end justify-center px-4 w-full py-4 gap-3 border shadow-sm rounded-3xl mb-4 transition bg-background",
        isDragging ? "ring-2 ring-primary/60 border-primary/40 bg-primary/5" : "ring-0",
        className,
      ),
    [className, isDragging],
  );

  const addFiles = useCallback((incoming: File[]) => {
    if (!incoming.length) return;

    setAttachments((prev) => {
      const next = [...prev];
      const existingKeys = new Set(prev.map((item) => getAttachmentKey(item.file)));

      for (const file of incoming) {
        const key = getAttachmentKey(file);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        next.push({
          id: uuidv4(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      return next;
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const attachment of prev) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return [];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) =>
        URL.revokeObjectURL(attachment.previewUrl),
      );
    };
  }, []);

  const handlePickFiles = () => fileInputRef.current?.click();

  const handleFilesChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.currentTarget.value = "";
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if ((event.target as HTMLElement).contains(event.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const dt = event.dataTransfer;
    if (!dt) return;

    const dropped: File[] = [];
    if (dt.items && dt.items.length) {
      for (const item of Array.from(dt.items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) dropped.push(file);
        }
      }
    } else if (dt.files && dt.files.length) {
      dropped.push(...Array.from(dt.files));
    }

    addFiles(dropped);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed && attachments.length === 0) return;

    try {
      await onSend({
        text: trimmed,
        files: attachments.map((item) => item.file),
      });
      setMessage("");
      clearAttachments();
    } catch (error) {
      // Let the upstream hook surface the error.
      console.error(error);
    }
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <ChatUploaderWrapper>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFilesChanged}
        accept="image/png,image/webp,image/jpeg,application/pdf"
      />

      <ComposerForm
        ref={formRef}
        className={dropZoneClassName}
        onSubmit={handleSubmit}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          const clickable = target.closest(
            "textarea,button,[role='button'],[data-no-open]",
          );
          if (!clickable) {
            handlePickFiles();
          }
        }}
        aria-label="Message input and file drop zone"
      >
        <ComposerToolbar>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-no-open
                className="cursor-pointer p-3 rounded-full bg-muted hover:bg-accent"
                title="More actions"
              >
                <Plus className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  handlePickFiles();
                }}
              >
                Upload file(s)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ComposerToolbar>

        <ComposerContent>
          <ComposerAttachments
            attachments={attachments}
            onRemove={removeAttachment}
          />

          <Textarea
            placeholder="Ask me anything…"
            value={message}
            onKeyDown={handleTextareaKeyDown}
            data-no-open
            onChange={(event) => setMessage(event.target.value)}
            disabled={loading}
            className="placeholder:text-muted-foreground rounded-2xl py-4 px-4 text-base border-none shadow-none focus-visible:ring-0 resize-none min-h-[48px]"
          />
        </ComposerContent>

        <ComposerSubmit
          loading={loading}
          onStop={onStop}
          canSubmit={canSubmit}
        />
      </ComposerForm>
    </ChatUploaderWrapper>
  );
}

type ComposerFormProps = React.FormHTMLAttributes<HTMLFormElement>;

const ComposerForm = Object.assign(
  React.forwardRef<HTMLFormElement, ComposerFormProps>(function ComposerForm(
    { className, children, ...props },
    ref,
  ) {
    return (
      <form
        ref={ref}
        className={cn("flex items-end gap-3", className)}
        {...props}
      >
        {children}
      </form>
    );
  }),
  { displayName: "ComposerForm" },
);

function ComposerToolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col justify-end">{children}</div>;
}

function ComposerContent({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 w-full">{children}</div>;
}

function ComposerAttachments({
  attachments,
  onRemove,
}: {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2" data-no-open>
      {attachments.map((attachment) => (
        <li
          key={attachment.id}
          className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2"
        >
          {attachment.file.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.previewUrl}
              alt={attachment.file.name}
              className="h-10 w-10 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <FileIcon className="h-5 w-5" />
            </div>
          )}
          <div className="flex flex-col text-xs leading-tight">
            <span className="font-medium text-foreground truncate max-w-[140px]">
              {attachment.file.name}
            </span>
            <span className="text-muted-foreground">
              {formatFileSize(attachment.file.size)}
            </span>
          </div>
          <button
            type="button"
            className="ml-auto rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => onRemove(attachment.id)}
            data-no-open
            aria-label={`Remove ${attachment.file.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ComposerSubmit({
  loading,
  onStop,
  canSubmit,
}: {
  loading: boolean;
  onStop?: () => void;
  canSubmit: boolean;
}) {
  return (
    <button
      type={loading ? "button" : "submit"}
      onClick={loading ? onStop : undefined}
      data-no-open
      disabled={!loading && !canSubmit}
      className={cn(
        "cursor-pointer p-3 rounded-full bg-muted hover:bg-accent group",
        !loading && !canSubmit && "opacity-60 cursor-not-allowed",
      )}
      title={loading ? "Stop request" : "Send message"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div
            key="stop"
            className="h-4 w-4 rounded-sm bg-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        ) : (
          <motion.div
            key="arrow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowRight className="h-4 w-4 text-foreground group-hover:text-muted-foreground" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function getAttachmentKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
