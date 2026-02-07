"use client";

import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

interface CopyToClipboardProps {
  text: string;
  className?: string;
}

export function CopyToClipboard({ text, className }: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      title="Copy to clipboard"
      className={cn(
        "inline-flex items-center w-fit gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border rounded-md px-2 py-2 transition-colors mt-4 cursor-pointer " +
          className,
      )}
    >
      {!copied && <Copy className="w-3.5 h-3.5" />}
      {copied && <Check className="w-3.5 h-3.5" />}
    </button>
  );
}
