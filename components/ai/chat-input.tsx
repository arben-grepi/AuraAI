"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, File as FileIcon, Plus, X } from "lucide-react";
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
        "flex items-end relative z-10 justify-center w-full px-2 py-2 gap-2 rounded-[30px] mb-4 border border-border bg-transparent transition",
        "shadow-[0_0_25px_-5px_#6AA9D240,0_0_35px_-5px_#EBD0F940,0_0_40px_-10px_#C1E6FF40,0_0_50px_-15px_#C6E5F540]",
        isDragging ? "ring-2 ring-primary/50 border-primary/40" : "ring-0",
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
            className="placeholder:text-gray-400 rounded-[24px] text-base border-none shadow-none focus-visible:ring-0 resize-none overflow-y-auto scrollbar-clean max-h-[280px] leading-6 py-4 px-4 bg-transparent"
          />
        </ComposerContent>

        <ComposerSubmit
          loading={loading}
          onStop={onStop}
          canSubmit={canSubmit}
        />

        <button
          type="button"
          onClick={handlePickFiles}
          data-no-open
          className="absolute bottom-2.5 right-2.5 cursor-pointer h-8 w-8 rounded-full border bg-white border-border flex items-center justify-center hover:bg-muted transition"
          title="Upload file"
        >
          <Plus className="w-4 h-4" />
        </button>
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
    <motion.div
      layout
      className="flex gap-2 mt-2 ml-2 overflow-x-auto items-end scrollbar-clean py-1 px-1"
      data-no-open
    >
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
        />
      ))}
    </motion.div>
  );
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove: (id: string) => void;
}) {
  const fileKey = getAttachmentKey(attachment.file);
  const isImage = attachment.file.type.startsWith("image/");
  const sanitizedName = sanitizeFileName(attachment.file.name);

  return isImage ? (
    <div className="relative" key={fileKey}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.previewUrl}
        alt={sanitizedName}
        className="rounded-[6px] object-cover w-[100px] h-[100px]"
      />
      <button
        type="button"
        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-100 hover:bg-gray-200 transition cursor-pointer flex items-center justify-center"
        onClick={() => onRemove(attachment.id)}
        aria-label={`Remove ${attachment.file.name}`}
        data-no-open
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  ) : (
    <div
      key={fileKey}
      className="flex p-2 shadow-sm w-fit rounded-[8px] cursor-pointer group relative h-fit bg-background/60"
    >
      <div className="flex justify-center items-center w-10 h-10 rounded-[6px] bg-neutral-100 mr-2">
        <FileIcon className="w-4 h-4" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium truncate max-w-[140px]">
          {sanitizedName}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatFileSize(attachment.file.size)}
        </div>
      </div>
      <button
        type="button"
        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-100 group-hover:flex hidden transition cursor-pointer items-center justify-center"
        onClick={() => onRemove(attachment.id)}
        aria-label={`Remove ${attachment.file.name}`}
        data-no-open
      >
        <X className="w-3 h-3" />
      </button>
    </div>
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

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\.\./g, "")
    .substring(0, 100);
}
