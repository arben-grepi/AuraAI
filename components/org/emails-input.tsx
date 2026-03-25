"use client";

import { useState, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { X } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailsInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Chip-style multi-email input.
 * - Type an email and press Enter, Tab, or comma/semicolon to add it.
 * - Paste comma/semicolon/newline-separated emails to add them all at once.
 * - Invalid emails are shown with a red chip.
 * - Click × to remove a chip.
 */
export function EmailsInput({
  value,
  onChange,
  disabled,
  placeholder = "Type an email and press Enter…",
}: EmailsInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const emails = raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!emails.length) return;

    const next = [...value];
    for (const e of emails) {
      if (!next.includes(e)) next.push(e);
    }
    onChange(next);
    setInput("");
  };

  const remove = (email: string) => onChange(value.filter((e) => e !== email));

  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", "Tab", ",", ";"].includes(ev.key)) {
      ev.preventDefault();
      if (input.trim()) add(input.trim());
    }
    if (ev.key === "Backspace" && !input && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const onPaste = (ev: ClipboardEvent<HTMLInputElement>) => {
    const text = ev.clipboardData.getData("text");
    if (text.includes(",") || text.includes(";") || text.includes("\n") || text.includes(" ")) {
      ev.preventDefault();
      add(text);
    }
  };

  const onBlur = () => {
    if (input.trim()) {
      add(input.trim());
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[42px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm cursor-text focus-within:ring-2 focus-within:ring-zinc-300 transition"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((email) => {
        const valid = EMAIL_RE.test(email);
        return (
          <span
            key={email}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              valid
                ? "bg-zinc-100 text-zinc-700"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {email}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(email);
                }}
                className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        );
      })}
      <input
        ref={inputRef}
        type="text"
        value={input}
        disabled={disabled}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={onBlur}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[160px] bg-transparent outline-none placeholder:text-zinc-400 text-sm disabled:cursor-not-allowed"
      />
    </div>
  );
}
