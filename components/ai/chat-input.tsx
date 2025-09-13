"use client";

import { Input } from "../ui/input";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "motion/react";
import { motion } from "motion/react";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      addMessage(message);
      setMessage("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-center justify-center px-4 w-full py-4 gap-2",
        className,
      )}
    >
      <Input
        placeholder="Ask me anything..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="placeholder:text-muted-foreground text-foreground rounded-full py-5 border-none bg-muted text-base"
      />
      <button
        type={loading ? "button" : "submit"}
        onClick={loading ? onStop : undefined}
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
  );
}
