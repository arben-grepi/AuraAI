"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { motion } from "motion/react";
import { File as FileIcon, Loader, Plus, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

import { ChatUploaderWrapper } from "./chat-uploader-wrapper";
import { toast } from "sonner";
import { UploadedAttachment } from "./types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MEDIA_TYPES = [
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export interface ChatInputHandle {
  focus: () => void;
}

interface ChatInputProps {
  onSend: (payload: {
    text?: string;
    attachments: UploadedAttachment[];
  }) => Promise<void> | void;
  loading: boolean;
  isAnonymous: boolean;
  onStop?: () => void;
  className?: string;
}

type ComposerAttachmentStatus = "uploading" | "ready" | "error";

interface ComposerAttachment extends UploadedAttachment {
  status: ComposerAttachmentStatus;
  previewUrl?: string;
  error?: string;
  fingerprint: string;
}

export const ChatInput = React.forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    { isAnonymous, onSend, loading, className }: ChatInputProps,
    ref,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    React.useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));
    const [message, setMessage] = useState("");
    const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentsRef = useRef<ComposerAttachment[]>([]);

    // const hasReadyAttachments = attachments.some(
    //   (attachment) => attachment.status === "ready",
    // );
    const isUploading = attachments.some(
      (attachment) => attachment.status === "uploading",
    );

    // const canSubmit =
    //   (message.trim().length > 0 || hasReadyAttachments) && !isUploading;

    const dropZoneClassName = useMemo(
      () =>
        cn(
          "flex items-end relative z-20 justify-center w-full px-2 py-2 gap-2 rounded-[30px] mb-4 border bg-white transition-all duration-300",
          isDragging
            ? "ring-2 ring-primary/50 border-primary/40"
            : isFocused
              ? "border-primary/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
              : "border-border ring-0",
          isAnonymous && "bg-zinc-800 text-white",
          className,
        ),
      [className, isDragging, isFocused, isAnonymous],
    );

    const uploadAndFinalize = useCallback(
      (file: File, attachmentId: string) => {
        void (async () => {
          try {
            const result = await uploadAttachmentToS3(file);

            setAttachments((prev) =>
              prev.map((item) => {
                if (item.id !== attachmentId) return item;
                const mediaType = result.mediaType || item.mediaType;
                const previewUrl =
                  item.previewUrl ??
                  (isImageType(mediaType) ? result.url : item.previewUrl);

                return {
                  ...item,
                  url: result.url,
                  objectKey: result.objectKey,
                  organizationId: result.organizationId ?? item.organizationId,
                  status: "ready" as const,
                  mediaType,
                  size: result.size ?? item.size,
                  previewUrl,
                };
              }),
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Upload failed";
            setAttachments((prev) =>
              prev.map((item) =>
                item.id === attachmentId
                  ? { ...item, status: "error", error: message }
                  : item,
              ),
            );
            toast.error(message);
          }
        })();
      },
      [],
    );

    const addFiles = useCallback(
      (incoming: File[]) => {
        if (!incoming.length) return;

        const validFiles: File[] = [];
        const tooLarge: string[] = [];
        const unsupported: string[] = [];

        for (const file of incoming) {
          if (file.size > MAX_FILE_SIZE) {
            tooLarge.push(file.name);
            continue;
          }

          const normalizedType = (file.type || "").toLowerCase();
          const normalizedName = file.name.toLowerCase();
          const allowed =
            (normalizedType && ALLOWED_MEDIA_TYPES.includes(normalizedType)) ||
            normalizedName.endsWith(".txt") ||
            normalizedName.endsWith(".pdf");

          if (!allowed) {
            unsupported.push(file.name);
            continue;
          }

          validFiles.push(file);
        }

        if (tooLarge.length) {
          const fileList = tooLarge.join(", ");
          toast.error(
            `${tooLarge.length} file${tooLarge.length > 1 ? "s are" : " is"} too large. Maximum file size is 5MB: ${fileList}`,
          );
        }

        if (unsupported.length) {
          const fileList = unsupported.join(", ");
          toast.error(
            `${unsupported.length} unsupported file${unsupported.length > 1 ? "s" : ""}: ${fileList}`,
          );
        }

        if (!validFiles.length) return;

        const existingFingerprints = new Set(
          attachmentsRef.current.map((item) => item.fingerprint),
        );

        const pendingAttachments: ComposerAttachment[] = [];

        for (const file of validFiles) {
          const fingerprint = getFileFingerprint(file);
          if (existingFingerprints.has(fingerprint)) continue;
          existingFingerprints.add(fingerprint);

          const id = uuidv4();
          const previewUrl = isImageType(file.type)
            ? URL.createObjectURL(file)
            : undefined;

          pendingAttachments.push({
            id,
            name: file.name,
            mediaType: file.type || "application/octet-stream",
            size: file.size,
            url: "",
            objectKey: undefined,
            organizationId: undefined,
            status: "uploading",
            previewUrl,
            fingerprint,
          });

          uploadAndFinalize(file, id);
        }

        if (pendingAttachments.length) {
          setAttachments((prev) => [...prev, ...pendingAttachments]);
        }
      },
      [uploadAndFinalize],
    );

    const clearAttachments = useCallback(() => {
      setAttachments((prev) => {
        prev.forEach((attachment) => revokePreviewUrl(attachment.previewUrl));
        return [];
      });
    }, []);

    const removeAttachment = useCallback((id: string) => {
      setAttachments((prev) => {
        const target = prev.find((item) => item.id === id);
        if (target) {
          revokePreviewUrl(target.previewUrl);
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
          revokePreviewUrl(attachment.previewUrl),
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
      if ((event.target as HTMLElement).contains(event.relatedTarget as Node))
        return;
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

      if (isUploading) {
        toast.info("Please wait for file uploads to finish.");
        return;
      }

      const trimmed = message.trim();
      const readyAttachments = attachments.filter(
        (attachment) => attachment.status === "ready" && attachment.url,
      );

      if (!trimmed && readyAttachments.length === 0) return;

      const previousMessage = message;
      setMessage("");
      clearAttachments();

      try {
        await onSend({
          text: trimmed || undefined,
          attachments: readyAttachments.map(toUploadedAttachment),
        });
        formRef.current?.focus();
      } catch (error) {
        console.error(error);
        toast.error(
          error instanceof Error ? error.message : "Failed to send message.",
        );
        setMessage(previousMessage);
      }
    };

    const handleTextareaKeyDown = (
      event: React.KeyboardEvent<HTMLTextAreaElement>,
    ) => {
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
          accept="image/png,image/webp,image/jpeg,application/pdf,text/plain,.txt"
        />
        <div className="relative z-0">
          <ComposerForm
            ref={formRef}
            className={dropZoneClassName}
            onSubmit={handleSubmit}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            // onClick={(event) => {
            //   const target = event.target as HTMLElement;
            //   const clickable = target.closest(
            //     "textarea,button,[role='button'],[data-no-open]",
            //   );
            //   if (!clickable) {
            //     handlePickFiles();
            //   }
            // }}
            aria-label="Message input and file drop zone"
          >
            <ComposerContent>
              <ComposerAttachments
                attachments={attachments}
                onRemove={removeAttachment}
              />

              <Textarea
                ref={textareaRef}
                placeholder="Ask me anything…"
                value={message}
                onKeyDown={handleTextareaKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                data-no-open
                onChange={(event) => setMessage(event.target.value)}
                disabled={loading}
                className="placeholder:text-gray-400 rounded-[24px] text-base border-none shadow-none focus-visible:ring-0 resize-none overflow-y-auto scrollbar-clean max-h-[280px] leading-6 py-4 px-4 bg-transparent"
              />
            </ComposerContent>
            <button
              type="button"
              onClick={handlePickFiles}
              data-no-open
              className="absolute bottom-2.5 right-2.5 cursor-pointer h-8 w-8 rounded-full border bg-white border-border flex items-center justify-center hover:bg-muted transition"
              title="Upload file"
            >
              <Plus className={`w-4 h-4 text-black`} />
            </button>
          </ComposerForm>
          <div className="min-h-[90px] absolute top-0 border-zinc-200 border w-full rounded-lg bg-linear-to-r from-[#6AA9D2]/50 via-[#EBD0F9] to-[#C6E5F5] z-0 blur-xl animate-pulse"></div>
        </div>
      </ChatUploaderWrapper>
    );
  },
);

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
  const isImage = isImageType(attachment.mediaType);
  const sanitizedName = sanitizeFileName(attachment.name);
  const displayUrl = attachment.previewUrl ?? attachment.url;
  const isUploading = attachment.status === "uploading";
  const isError = attachment.status === "error";
  const errorMessage = attachment.error ?? "Upload failed";

  return isImage ? (
    <div className="relative" key={attachment.id}>
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayUrl}
          alt={sanitizedName}
          className="rounded-[6px] object-cover w-[100px] h-[100px]"
        />
      ) : (
        <div className="rounded-[6px] w-[100px] h-[100px] bg-muted flex items-center justify-center">
          <Loader className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {isUploading && (
        <div className="absolute inset-0 bg-black/40 rounded-[6px] flex items-center justify-center">
          <Loader className="size-5 animate-spin text-white" />
        </div>
      )}
      {isError && (
        <div className="absolute bottom-1 left-1 right-1 text-[11px] text-white bg-red-500/90 rounded px-1 py-0.5">
          {errorMessage}
        </div>
      )}
      <button
        type="button"
        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-100 hover:bg-gray-200 transition cursor-pointer flex items-center justify-center"
        onClick={() => onRemove(attachment.id)}
        aria-label={`Remove ${attachment.name}`}
        data-no-open
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  ) : (
    <div
      key={attachment.id}
      className="flex p-2 shadow-sm w-fit rounded-[8px] cursor-pointer group relative h-fit bg-background/60"
    >
      <div className="flex justify-center items-center w-10 h-10 rounded-[6px] bg-neutral-100 mr-2">
        <FileIcon className="w-4 h-4" />
      </div>
      <div className="flex flex-col gap-1 pr-4">
        <div className="text-sm font-medium truncate max-w-[160px]">
          {sanitizedName}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size)}
        </div>
        {isUploading && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader className="size-3 animate-spin" /> Uploading…
          </div>
        )}
        {isError && <div className="text-xs text-red-600">{errorMessage}</div>}
      </div>
      <button
        type="button"
        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gray-100 group-hover:flex hidden transition cursor-pointer items-center justify-center"
        onClick={() => onRemove(attachment.id)}
        aria-label={`Remove ${attachment.name}`}
        data-no-open
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// function ComposerSubmit({
//   loading,
//   onStop,
//   canSubmit,
// }: {
//   loading: boolean;
//   onStop?: () => void;
//   canSubmit: boolean;
// }) {
//   return (
//     <button
//       type={loading ? "button" : "submit"}
//       onClick={loading ? onStop : undefined}
//       data-no-open
//       disabled={!loading && !canSubmit}
//       className={cn(
//         "cursor-pointer p-3 rounded-full bg-muted hover:bg-accent group",
//         !loading && !canSubmit && "opacity-60 cursor-not-allowed",
//       )}
//       title={loading ? "Stop request" : "Send message"}
//     >
//       <AnimatePresence mode="wait" initial={false}>
//         {loading ? (
//           <motion.div
//             key="stop"
//             className="h-4 w-4 rounded-sm bg-foreground"
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0 }}
//             transition={{ duration: 0.2 }}
//           />
//         ) : (
//           <motion.div
//             key="arrow"
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             exit={{ opacity: 0 }}
//             transition={{ duration: 0.2 }}
//           >
//             <ArrowRight className="h-4 w-4 text-foreground group-hover:text-muted-foreground" />
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </button>
//   );
// }

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\.\./g, "")
    .substring(0, 100);
}

function toUploadedAttachment(
  attachment: ComposerAttachment,
): UploadedAttachment {
  const { id, name, url, mediaType, size, objectKey, organizationId } =
    attachment;

  return {
    id,
    name,
    url,
    mediaType,
    size,
    objectKey,
    organizationId,
  };
}

interface AttachmentUploadResult {
  url: string;
  objectKey?: string;
  mediaType: string;
  size: number;
  organizationId?: string | null;
}

async function uploadAttachmentToS3(
  file: File,
): Promise<AttachmentUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/ai/chat/attachments", {
    method: "POST",
    body: formData,
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new Error("Upload failed");
    }
    throw error;
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : "Upload failed";
    throw new Error(errorMessage);
  }

  const result = data as AttachmentUploadResult;

  if (!result.url) {
    throw new Error("Upload response missing file URL");
  }

  return result;
}

function isImageType(mediaType: string) {
  return mediaType.toLowerCase().startsWith("image/");
}

function getFileFingerprint(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function revokePreviewUrl(previewUrl?: string) {
  if (previewUrl && previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(previewUrl);
  }
}
