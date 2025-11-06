"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Pluggable } from "unified";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
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
    <div className="text-base prose dark:prose-invert max-w-none sm:prose-base prose-sm w-full min-w-0 overflow-hidden break-words prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:my-4 prose-pre:overflow-x-auto prose-pre:max-w-full prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-p:my-2 prose-p:break-words prose-ul:my-2 prose-ol:my-2 prose-h1:my-4 prose-h2:my-4 prose-h3:my-3 prose-h4:my-3 prose-h5:my-3 prose-h6:my-3 prose-blockquote:my-4 prose-hr:my-6">
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
                className="max-w-full h-auto rounded-md border border-border my-3"
                {...props}
              />
            );
          },
          p({ children, ...props }) {
            return (
              <p
                className="text-foreground leading-6 mb-3 last:mb-0"
                {...props}
              >
                {children}
              </p>
            );
          },
          h1({ children, ...props }) {
            return (
              <h1
                className="text-3xl font-bold text-foreground mb-6 mt-8 first:mt-0 border-b border-border pb-2"
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2
                className="text-2xl font-semibold text-foreground mb-4 mt-6 first:mt-0"
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3
                className="text-xl font-semibold text-foreground mb-3 mt-5 first:mt-0"
                {...props}
              >
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            return (
              <h4
                className="text-lg font-medium text-foreground mb-2 mt-4 first:mt-0"
                {...props}
              >
                {children}
              </h4>
            );
          },
          h5({ children, ...props }) {
            return (
              <h5
                className="text-base font-medium text-foreground mb-2 mt-3 first:mt-0"
                {...props}
              >
                {children}
              </h5>
            );
          },
          h6({ children, ...props }) {
            return (
              <h6
                className="text-sm font-medium text-muted-foreground mb-2 mt-3 first:mt-0"
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
                className="list-disc list-inside mb-4 space-y-1 text-foreground"
                {...props}
              >
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol
                className="list-decimal list-inside mb-4 space-y-1 text-foreground"
                {...props}
              >
                {children}
              </ol>
            );
          },
          li({ children, ...props }) {
            return (
              <li className="text-foreground leading-6" {...props}>
                {children}
              </li>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-4 border-primary pl-4 py-2 my-4 bg-muted/50 rounded-r-md italic text-muted-foreground"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          hr({ ...props }) {
            return <hr className="border-border my-6" {...props} />;
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
              <pre className="bg-muted border border-border rounded-lg overflow-x-auto max-w-full my-4 w-full min-w-0">
                <code
                  className={cn(
                    "text-sm font-mono whitespace-pre-wrap break-words min-w-0 block w-full",
                    className,
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
              <div className="overflow-x-auto my-4">
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
