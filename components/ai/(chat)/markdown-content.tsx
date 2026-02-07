"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Pluggable } from "unified";

interface MarkdownContentProps {
  content: string;
  citations?: Record<string, { name: string }>;
}

/**
 * Collapses 3+ consecutive newlines to exactly 2 so markdown produces at most
 * one blank line between blocks and avoids excessive vertical spacing.
 */
function normalizeNewlines(content: string): string {
  return content.replace(/\n{3,}/g, "\n\n").trim();
}

function applyCitations(
  content: string,
  citations?: Record<string, { name: string }>
): string {
  if (!citations || Object.keys(citations).length === 0) return content;
  return content.replace(/\[\[\s*(\d+)\s*\]\]/g, (_, n) => {
    const c = citations[n];
    return c ? `(Source: ${c.name})` : `(Source: Document ${n})`;
  });
}

/**
 * Collapses excessive newlines around citation lines so "(Source: ...)" does
 * not create huge vertical gaps. At most one blank line before and after each.
 */
function normalizeCitationSpacing(content: string): string {
  return content
    .replace(/(\n{2,})(\s*\(Source:[^)]+\)\s*)(\n{2,})/g, "\n\n$2\n\n")
    .replace(/^(\n{2,})(\s*\(Source:[^)]+\)\s*)/m, "\n\n$2")
    .replace(/(\s*\(Source:[^)]+\)\s*)(\n{2,})$/m, "$1\n\n");
}

export function MarkdownContent({ content, citations }: MarkdownContentProps) {
  const normalized = normalizeNewlines(content);
  const withCitations = applyCitations(normalized, citations);
  const renderedContent = normalizeCitationSpacing(withCitations);
  const [rehypeHighlight, setRehypeHighlight] =
    React.useState<Pluggable | null>(null);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const mod = (await import("rehype-highlight")) as {
          default: Pluggable;
        };
        if (mounted) setRehypeHighlight(() => mod.default);
      } catch {
        // no-op if unavailable,
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Syntax highlighting theme is imported globally via app/globals.css

  return (
    <div className="text-base prose dark:prose-invert max-w-none sm:prose-base prose-sm w-full min-w-0 overflow-x-hidden prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypeHighlight ? [rehypeHighlight] : []}
        components={{
          img({ src, alt, ...props }) {
            return (
              // eslint-disable-next-line @next/next/no-img-element,
              <img
                src={src ?? ""}
                alt={alt ?? ""}
                className="max-w-full h-auto rounded-md border border-border my-2"
                {...props}
              />
            );
          },
          p({ children, ...props }) {
            return (
              <p
                className="text-foreground leading-6 mb-1.5 last:mb-0"
                {...props}
              >
                {children}
              </p>
            );
          },
          h1({ children, ...props }) {
            return (
              <h1
                className="text-3xl font-bold text-foreground mb-2 mt-3 first:mt-0 border-b border-border pb-1.5"
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2
                className="text-2xl font-semibold text-foreground mb-1.5 mt-3 first:mt-0"
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3
                className="text-xl font-semibold text-foreground mb-1 mt-2 first:mt-0"
                {...props}
              >
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            return (
              <h4
                className="text-lg font-medium text-foreground mb-0.5 mt-1.5 first:mt-0"
                {...props}
              >
                {children}
              </h4>
            );
          },
          h5({ children, ...props }) {
            return (
              <h5
                className="text-base font-medium text-foreground mb-0.5 mt-1.5 first:mt-0"
                {...props}
              >
                {children}
              </h5>
            );
          },
          h6({ children, ...props }) {
            return (
              <h6
                className="text-sm font-medium text-muted-foreground mb-0.5 mt-1.5 first:mt-0"
                {...props}
              >
                {children}
              </h6>
            );
          },
          strong({ children, ...props }) {
            return (
              <strong className="font-semibold text-foreground" {...props}>
                {children}
              </strong>
            );
          },
          em({ children, ...props }) {
            return (
              <em className="italic text-foreground" {...props}>
                {children}
              </em>
            );
          },
          ul({ children, ...props }) {
            return (
              <ul
                className="list-disc list-outside my-1.5 last:mb-0 ml-0 pl-6 space-y-0.5 text-foreground [&_ul]:mt-0.5 [&_ol]:mt-0.5"
                style={{ listStylePosition: "outside" }}
                {...props}
              >
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol
                className="list-decimal list-outside my-1.5 last:mb-0 ml-0 pl-7 space-y-0.5 text-foreground [&_ul]:mt-0.5 [&_ol]:mt-0.5"
                style={{ listStylePosition: "outside" }}
                {...props}
              >
                {children}
              </ol>
            );
          },
          li({ children, ...props }) {
            return (
              <li
                className="text-foreground leading-relaxed list-item [&_p]:my-0 [&_ul]:my-1 [&_ol]:my-1 [&_ul]:pl-4 [&_ol]:pl-4"
                style={{ listStylePosition: "outside" }}
                {...props}
              >
                {children}
              </li>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-4 border-primary pl-4 py-1.5 my-1.5 bg-muted/50 rounded-r-md italic text-muted-foreground"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          hr({ ...props }) {
            return <hr className="border-border my-3 shrink-0" {...props} />;
          },
          pre({ children, ...props }) {
            const arr = React.Children.toArray(children);
            const single = arr.length === 1 && React.isValidElement(arr[0]);
            const isOurCodeBlock =
              single &&
              (
                arr[0] as React.ReactElement & {
                  props?: { "data-code-block"?: unknown };
                }
              ).props?.["data-code-block"] != null;
            if (isOurCodeBlock) return <>{children}</>;
            return (
              <pre
                className="my-1.5 overflow-x-auto rounded-lg border border-border bg-muted py-3 px-4 text-sm"
                {...props}
              >
                {children}
              </pre>
            );
          },
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                {...props}
              >
                {children}
              </a>
            );
          },
          code({ className, children, ...props }) {
            const inline = !className?.includes("language-");
            if (inline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre
                data-code-block
                className="my-1.5 w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-muted py-3 px-4 text-sm"
              >
                <code
                  className={cn(
                    "font-mono whitespace-pre block text-foreground",
                    className
                  )}
                  {...props}
                >
                  {children}
                </code>
              </pre>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto my-2">
                <table
                  className="min-w-full border-collapse border border-border rounded-lg"
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th
                className="border border-border px-4 py-2 bg-muted text-left font-semibold text-foreground"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td
                className="border border-border px-4 py-2 text-foreground"
                {...props}
              >
                {children}
              </td>
            );
          },
        }}
      >
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}
