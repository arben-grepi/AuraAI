"use client";

import { Input } from "../ui/input";
import { ArrowRight, File as FileIcon, Plus } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "motion/react";
import { motion } from "motion/react";
import { ChatUploaderWrapper } from "./chat-uploader-wrapper";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";

export function ChatInput({
  addMessage,
  loading,
  onStop,
  className,
}: {
  addMessage: (message: string) => void;
  loading: boolean;
  onStop?: () => void;
  className?: string;
}) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // hidden input lives outside the menu
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    if (!incoming.length) return;
    // Optional: de-dup by name+size+lastModified
    setFiles((prev) => {
      const key = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
      const seen = new Set(prev.map(key));
      const filtered = incoming.filter((f) => !seen.has(key(f)));
      return [...prev, ...filtered];
    });
  }, []);

  const handlePickFiles = () => fileInputRef.current?.click();

  const handleFilesChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.currentTarget.value = "";
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ((e.target as HTMLElement).contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    const dropped: File[] = [];
    if (dt.items && dt.items.length) {
      for (const item of Array.from(dt.items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) dropped.push(f);
        }
      }
    } else if (dt.files && dt.files.length) {
      dropped.push(...Array.from(dt.files));
    }
    addFiles(dropped);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      addMessage(message);
      setMessage("");
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
      <form
        onSubmit={handleSubmit}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const clickable =
            target.closest("input,button,[role='button'],[data-no-open]") !=
            null;
          if (!clickable) handlePickFiles();
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-no-open
        aria-label="Message input and file drop zone"
        className={cn(
          "flex items-end justify-center px-4 w-full py-4 gap-2 border shadow-sm rounded-3xl mb-4 transition",
          isDragging
            ? "ring-2 ring-primary/60 border-primary/40 bg-primary/5"
            : "ring-0",
          className,
        )}
      >
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
              onSelect={(e) => {
                e.preventDefault();
                handlePickFiles();
              }}
            >
              Upload file(s)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex flex-col gap-4 w-full">
          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              {files.map((f) => (
                <div
                  key={`${f.name}-${f.size}-${f.lastModified}`}
                  className="flex items-center gap-2"
                >
                  <FileIcon className="w-4 h-4" />
                  <div className="text-sm font-medium">{f.name}</div>
                </div>
              ))}
            </div>
          )}
          <Input
            placeholder="Ask me anything…"
            value={message}
            data-no-open
            onChange={(e) => setMessage(e.target.value)}
            className="placeholder:text-muted-foreground rounded-full py-5 text-base border-none shadow-none focus-visible:ring-0"
          />
        </div>

        <button
          type={loading ? "button" : "submit"}
          onClick={loading ? onStop : undefined}
          data-no-open
          className="cursor-pointer p-3 rounded-full bg-muted hover:bg-accent group"
          title={loading ? "Stop request" : "Send message"}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="pause"
                className="w-4 h-4 rounded-sm bg-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            ) : (
              <motion.div
                key="arrow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ArrowRight className="size-4 text-foreground group-hover:text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </form>
    </ChatUploaderWrapper>
  );
}
