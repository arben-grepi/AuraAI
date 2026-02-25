"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FileText } from "lucide-react";

export interface SourcePanelState {
  open: boolean;
  resourceId: string;
  resourceName: string;
  startOffset?: number;
  endOffset?: number;
}

interface SourcePanelProps {
  state: SourcePanelState | null;
  onClose: () => void;
}

export function SourcePanel({ state, onClose }: SourcePanelProps) {
  const [fullText, setFullText] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const highlightRef = React.useRef<HTMLElement | null>(null);

  const isOpen = state?.open ?? false;
  const resourceId = state?.resourceId;

  React.useEffect(() => {
    if (!isOpen || !resourceId) {
      setFullText(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/resources/${resourceId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load document");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setFullText(data.fullText ?? null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, resourceId]);

  // Auto-scroll to highlighted text
  React.useEffect(() => {
    if (fullText && highlightRef.current) {
      // Small delay to let DOM render
      const timer = setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [fullText, state?.startOffset, state?.endOffset]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="flex gap-2 items-center">
            <div className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" />
            <div className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce delay-100" />
            <div className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce delay-200" />
            <span className="ml-2 text-sm">Loading document...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12 text-destructive text-sm">
          {error}
        </div>
      );
    }

    if (!fullText) {
      return (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Full text not available for this document. It may have been uploaded
          before full-text storage was enabled.
        </div>
      );
    }

    const startOffset = state?.startOffset;
    const endOffset = state?.endOffset;

    // If we have offsets, split text into before/highlighted/after
    if (
      startOffset != null &&
      endOffset != null &&
      startOffset >= 0 &&
      endOffset > startOffset &&
      endOffset <= fullText.length
    ) {
      const before = fullText.slice(0, startOffset);
      const highlighted = fullText.slice(startOffset, endOffset);
      const after = fullText.slice(endOffset);

      return (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground font-mono">
          {before}
          <mark
            ref={highlightRef}
            className="bg-yellow-200 dark:bg-yellow-800/60 rounded px-0.5"
          >
            {highlighted}
          </mark>
          {after}
        </div>
      );
    }

    // No offsets — just show the full text
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground font-mono">
        {fullText}
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto"
      >
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <SheetTitle className="text-sm font-medium truncate">
              {state?.resourceName ?? "Document"}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="pt-4 pb-8">{renderContent()}</div>
      </SheetContent>
    </Sheet>
  );
}
