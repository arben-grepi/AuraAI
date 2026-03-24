"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Loader,
  Globe,
  CircleCheck,
  CircleX,
  Play,
  RefreshCw,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  handleUpdateOrganizationSources,
  handleDeleteOrganizationSource,
} from "@/lib/actions";
import type { Organization, SourceIndexInfo } from "@/lib/types";

const urlSchema = z.url({ error: "Please enter a valid URL" });

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

type VerificationStatus = "idle" | "verifying" | "safe" | "unsafe";

interface SourceEntry {
  value: string;
  error: string | null;
  verification: VerificationStatus;
  verificationReason: string | null;
}

type IndexingStatus =
  | { state: "idle" }
  | { state: "crawling"; url: string; pagesFound: number; pagesCrawled: number }
  | { state: "indexing"; page: number; total: number; title: string }
  | { state: "done"; pagesIndexed: number; totalChunks: number }
  | { state: "error"; message: string };

const DEBOUNCE_MS = 800;

function createEntry(
  value: string,
  verification: VerificationStatus = "idle",
): SourceEntry {
  return { value, error: null, verification, verificationReason: null };
}

async function verifyUrl(
  url: string,
): Promise<{ safe: boolean; reason: string }> {
  const response = await fetch("/api/ai/verify-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return response.json();
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
}

export default function Sources({ orgSlug }: { orgSlug: string }) {
  const { data: org, isLoading } = useQuery<Organization>({
    queryKey: ["sources", orgSlug],
    queryFn: async () => {
      const response = await fetch(`/api/org?slug=${orgSlug}`);
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Failed to load organization data
      </div>
    );
  }

  return <SourcesForm org={org} />;
}

function SourcesForm({ org }: { org: Organization }) {
  const initialSources: SourceEntry[] =
    org.sources.length > 0
      ? org.sources.map((s) => createEntry(s, "safe"))
      : [createEntry("")];

  const [sources, setSources] = useState<SourceEntry[]>(initialSources);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSource, setDeletingSource] = useState<string | null>(null);
  const [indexingStates, setIndexingStates] = useState<
    Record<string, IndexingStatus>
  >({});
  const [indexInfo, setIndexInfo] = useState<Record<string, SourceIndexInfo>>(
    {},
  );
  const debounceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    async function fetchIndexStatus() {
      try {
        const response = await fetch(
          `/api/org/sources/index?organizationId=${org.id}`,
        );
        if (!response.ok) return;
        const data: SourceIndexInfo[] = await response.json();
        const map: Record<string, SourceIndexInfo> = {};
        for (const entry of data) {
          map[entry.sourceUrl] = entry;
        }
        setIndexInfo(map);
      } catch {}
    }
    fetchIndexStatus();
  }, [org.id]);

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const hasChanges = (() => {
    const currentUrls = sources.map((s) => s.value).filter(Boolean);
    const originalUrls = org.sources;
    if (currentUrls.length !== originalUrls.length) return true;
    return currentUrls.some((url, i) => url !== originalUrls[i]);
  })();

  const hasUnsafeSource = sources.some((s) => s.verification === "unsafe");
  const hasPendingVerification = sources.some(
    (s) => s.value.trim() && s.verification === "verifying",
  );

  const triggerVerification = useCallback(
    async (index: number, url: string) => {
      const parsed = urlSchema.safeParse(url.trim());
      if (!parsed.success) return;

      setSources((prev) =>
        prev.map((e, i) =>
          i === index
            ? { ...e, verification: "verifying", verificationReason: null }
            : e,
        ),
      );

      try {
        const result = await verifyUrl(url.trim());
        setSources((prev) =>
          prev.map((e, i) =>
            i === index
              ? {
                  ...e,
                  verification: result.safe ? "safe" : "unsafe",
                  verificationReason: result.reason,
                  error: result.safe ? null : result.reason,
                }
              : e,
          ),
        );
      } catch {
        setSources((prev) =>
          prev.map((e, i) =>
            i === index
              ? { ...e, verification: "idle", verificationReason: null }
              : e,
          ),
        );
      }
    },
    [],
  );

  const handleAddSource = () => {
    setSources((prev) => [...prev, createEntry("")]);
  };

  const handleRemoveSource = (index: number) => {
    const existing = debounceTimers.current.get(index);
    if (existing) {
      clearTimeout(existing);
      debounceTimers.current.delete(index);
    }
    setSources((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSourceChange = (index: number, value: string) => {
    setSources((prev) =>
      prev.map((entry, i) =>
        i === index
          ? {
              ...entry,
              value,
              error: null,
              verification: "idle",
              verificationReason: null,
            }
          : entry,
      ),
    );

    const existing = debounceTimers.current.get(index);
    if (existing) clearTimeout(existing);

    if (!value.trim()) return;

    const timer = setTimeout(() => {
      debounceTimers.current.delete(index);
      const normalized = normalizeUrl(value);
      const parsed = urlSchema.safeParse(normalized);
      if (parsed.success) {
        setSources((prev) =>
          prev.map((e, i) => (i === index ? { ...e, value: normalized } : e)),
        );
        triggerVerification(index, normalized);
      }
    }, DEBOUNCE_MS);

    debounceTimers.current.set(index, timer);
  };

  const validateSource = (index: number) => {
    const entry = sources[index];
    if (!entry.value.trim()) return;

    const normalized = normalizeUrl(entry.value);
    const result = urlSchema.safeParse(normalized);
    if (!result.success) {
      setSources((prev) =>
        prev.map((e, i) =>
          i === index
            ? { ...e, error: result.error.issues[0]?.message ?? "Invalid URL" }
            : e,
        ),
      );
    } else if (normalized !== entry.value) {
      setSources((prev) =>
        prev.map((e, i) => (i === index ? { ...e, value: normalized } : e)),
      );
    }
  };

  const handleSave = async () => {
    if (hasUnsafeSource) {
      toast.error("Remove unsafe sources before saving");
      return;
    }

    if (hasPendingVerification) {
      toast.error("Wait for all sources to finish verification");
      return;
    }

    const nonEmptySources = sources.filter((s) => s.value.trim());

    if (nonEmptySources.length === 0) {
      const result = await saveSourcesAction([]);
      if (result) setSources([createEntry("")]);
      return;
    }

    let hasValidationError = false;
    const validated = nonEmptySources.map((entry) => {
      const normalized = normalizeUrl(entry.value);
      const result = urlSchema.safeParse(normalized);
      if (!result.success) {
        hasValidationError = true;
        return {
          ...entry,
          error: result.error.issues[0]?.message ?? "Invalid URL",
        };
      }
      return { ...entry, value: normalized, error: null };
    });

    if (hasValidationError) {
      const updatedSources = sources.map((entry) => {
        if (!entry.value.trim()) return entry;
        const found = validated.find((v) => v.value === entry.value.trim());
        return found ?? entry;
      });
      setSources(updatedSources);
      toast.error("Please fix the invalid URLs before saving");
      return;
    }

    const urls = validated.map((v) => v.value);
    await saveSourcesAction(urls);
  };

  const saveSourcesAction = async (urls: string[]): Promise<boolean> => {
    setIsSaving(true);
    try {
      const result = await handleUpdateOrganizationSources({
        organizationId: org.id,
        sources: urls,
      });

      if (result.success) {
        toast.success(result.data?.data ?? "Sources updated");
        return true;
      }

      toast.error(result.error ?? "Failed to update sources");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleIndexSource = async (sourceUrl: string) => {
    const status = indexingStates[sourceUrl];
    if (status?.state === "crawling" || status?.state === "indexing") return;

    setIndexingStates((prev) => ({
      ...prev,
      [sourceUrl]: {
        state: "crawling",
        url: sourceUrl,
        pagesFound: 0,
        pagesCrawled: 0,
      },
    }));

    try {
      const response = await fetch("/api/org/sources/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl, organizationId: org.id }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start indexing");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            handleSSEEvent(sourceUrl, event);
          } catch {}
        }
      }

      if (buffer.startsWith("data: ")) {
        try {
          const event = JSON.parse(buffer.slice(6));
          handleSSEEvent(sourceUrl, event);
        } catch {}
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Indexing failed";
      setIndexingStates((prev) => ({
        ...prev,
        [sourceUrl]: { state: "error", message },
      }));
      toast.error(message);
    }
  };

  const handleSSEEvent = (
    sourceUrl: string,
    event: Record<string, unknown>,
  ) => {
    switch (event.type) {
      case "crawl_progress":
        setIndexingStates((prev) => ({
          ...prev,
          [sourceUrl]: {
            state: "crawling",
            url: event.url as string,
            pagesFound: event.pagesFound as number,
            pagesCrawled: event.pagesCrawled as number,
          },
        }));
        break;
      case "crawl_done":
        break;
      case "indexing_page":
        setIndexingStates((prev) => ({
          ...prev,
          [sourceUrl]: {
            state: "indexing",
            page: event.page as number,
            total: event.total as number,
            title: event.title as string,
          },
        }));
        break;
      case "done":
        setIndexingStates((prev) => ({
          ...prev,
          [sourceUrl]: {
            state: "done",
            pagesIndexed: event.pagesIndexed as number,
            totalChunks: event.totalChunks as number,
          },
        }));
        setIndexInfo((prev) => ({
          ...prev,
          [sourceUrl]: {
            id: prev[sourceUrl]?.id ?? "",
            sourceUrl,
            lastIndexedAt: new Date().toISOString(),
            pagesIndexed: event.pagesIndexed as number,
            totalChunks: event.totalChunks as number,
          },
        }));
        toast.success(
          `Indexed ${event.pagesIndexed} pages (${event.totalChunks} chunks)`,
        );
        break;
      case "error":
        setIndexingStates((prev) => ({
          ...prev,
          [sourceUrl]: { state: "error", message: event.message as string },
        }));
        toast.error(event.message as string);
        break;
    }
  };

  const handleDeleteSource = async (sourceUrl: string, index: number) => {
    if (deletingSource) return;
    setDeletingSource(sourceUrl);

    try {
      const result = await handleDeleteOrganizationSource({
        organizationId: org.id,
        sourceUrl,
      });

      if (result.success) {
        // Remove from local state
        setSources((prev) => {
          const updated = prev.filter((_, i) => i !== index);
          return updated.length === 0 ? [createEntry("")] : updated;
        });
        setIndexInfo((prev) => {
          const updated = { ...prev };
          delete updated[sourceUrl];
          return updated;
        });
        setIndexingStates((prev) => {
          const updated = { ...prev };
          delete updated[sourceUrl];
          return updated;
        });
        // Update org.sources reference so hasChanges recalculates correctly
        org.sources = org.sources.filter((s) => s !== sourceUrl);
        toast.success("Source and all its data deleted");
      } else {
        toast.error(result.error ?? "Failed to delete source");
      }
    } finally {
      setDeletingSource(null);
    }
  };

  const isSavedSource = (url: string) => org.sources.includes(url.trim());

  return (
    <div>
      <div className="w-full flex justify-between px-8 py-10 border-b border-zinc-200">
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-xl">Trusted sources</h1>
          <p className="text-sm text-muted-foreground">
            Add URLs that the AI can reference as trusted sources
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="w-fit py-5"
            onClick={handleSave}
            disabled={
              !hasChanges ||
              isSaving ||
              hasUnsafeSource ||
              hasPendingVerification
            }
          >
            {isSaving && <Loader className="size-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>

      <div className="px-8 py-10">
        <div className="flex flex-col gap-4 max-w-[600px]">
          {sources.map((entry, index) => {
            const trimmedUrl = entry.value.trim();
            const indexStatus = indexingStates[trimmedUrl];
            const savedIndexInfo = indexInfo[trimmedUrl];
            const isIndexing =
              indexStatus?.state === "crawling" ||
              indexStatus?.state === "indexing";
            const canIndex =
              entry.verification === "safe" &&
              isSavedSource(entry.value) &&
              !isIndexing;
            const isAlreadyIndexed = !!savedIndexInfo;

            return (
              <div key={index} className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`source-${index}`}
                  className="text-sm font-medium"
                >
                  Source {index + 1}
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id={`source-${index}`}
                      type="url"
                      placeholder="https://example.com"
                      value={entry.value}
                      onChange={(e) =>
                        handleSourceChange(index, e.target.value)
                      }
                      onBlur={() => validateSource(index)}
                      className={`pl-9 pr-10 ${
                        entry.error || entry.verification === "unsafe"
                          ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                          : entry.verification === "safe"
                            ? "border-emerald-500 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                            : ""
                      }`}
                      aria-label={`Source ${index + 1} URL`}
                      aria-invalid={
                        !!entry.error || entry.verification === "unsafe"
                      }
                    />
                    <VerificationIndicator
                      status={entry.verification}
                      reason={entry.verificationReason}
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleIndexSource(trimmedUrl)}
                        disabled={!canIndex}
                        className="shrink-0"
                        aria-label={`Index source ${index + 1}`}
                      >
                        {isIndexing ? (
                          <Loader className="size-4 animate-spin" />
                        ) : isAlreadyIndexed ||
                          indexStatus?.state === "done" ? (
                          <RefreshCw className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {!isSavedSource(entry.value)
                        ? "Save the source first to index"
                        : isIndexing
                          ? "Indexing in progress..."
                          : isAlreadyIndexed || indexStatus?.state === "done"
                            ? "Re-index source"
                            : "Index source"}
                    </TooltipContent>
                  </Tooltip>
                  {(sources.length > 1 || isSavedSource(entry.value)) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (isSavedSource(entry.value) && (isAlreadyIndexed || indexStatus?.state === "done")) {
                              handleDeleteSource(trimmedUrl, index);
                            } else {
                              handleRemoveSource(index);
                            }
                          }}
                          disabled={isIndexing || deletingSource === trimmedUrl}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove source ${index + 1}`}
                          tabIndex={0}
                        >
                          {deletingSource === trimmedUrl ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isSavedSource(entry.value) && (isAlreadyIndexed || indexStatus?.state === "done")
                          ? "Remove source and all indexed data"
                          : "Remove"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                {entry.error && (
                  <p className="text-xs text-destructive">{entry.error}</p>
                )}
                {isIndexing ? (
                  <IndexingProgress status={indexStatus} />
                ) : indexStatus?.state === "error" ? (
                  <IndexingProgress status={indexStatus} />
                ) : savedIndexInfo ? (
                  <LastIndexedInfo info={savedIndexInfo} />
                ) : null}
              </div>
            );
          })}

          <Button
            variant="outline"
            onClick={handleAddSource}
            className="w-fit mt-2"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add source
          </Button>
        </div>
      </div>
    </div>
  );
}

function LastIndexedInfo({ info }: { info: SourceIndexInfo }) {
  return (
    <p className="text-xs text-muted-foreground mt-1">
      Last indexed {formatRelativeTime(info.lastIndexedAt)} &middot;{" "}
      {info.pagesIndexed} page{info.pagesIndexed !== 1 ? "s" : ""},{" "}
      {info.totalChunks} chunk{info.totalChunks !== 1 ? "s" : ""}
    </p>
  );
}

function IndexingProgress({ status }: { status: IndexingStatus | undefined }) {
  if (!status || status.state === "idle") return null;

  if (status.state === "crawling") {
    return (
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader className="size-3 animate-spin" />
          <span>Discovering pages... {status.pagesCrawled} found</span>
        </div>
        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary/60 rounded-full animate-pulse w-full" />
        </div>
      </div>
    );
  }

  if (status.state === "indexing") {
    const percent = Math.round((status.page / status.total) * 100);
    return (
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader className="size-3 animate-spin" />
          <span>
            Indexing page {status.page} of {status.total}
          </span>
        </div>
        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (status.state === "error") {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive mt-1">
        <CircleX className="w-3 h-3" />
        <span>{status.message}</span>
      </div>
    );
  }

  return null;
}

function VerificationIndicator({
  status,
  reason,
}: {
  status: VerificationStatus;
  reason: string | null;
}) {
  if (status === "idle") return null;

  if (status === "verifying") {
    return (
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <Loader className="size-4 mr-2 animate-spin" />
      </div>
    );
  }

  const isSafe = status === "safe";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-default"
          role="status"
          aria-label={isSafe ? "URL verified as safe" : "URL flagged as unsafe"}
        >
          {isSafe ? (
            <CircleCheck className="w-4 h-4 text-emerald-500" />
          ) : (
            <CircleX className="w-4 h-4 text-destructive" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px]">
        <p className="text-xs">
          {reason ?? (isSafe ? "Verified as safe" : "Flagged as unsafe")}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
