import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "./markdown-content";
import { motion } from "motion/react";

const messageVariants = cva("flex w-full mb-4", {
  variants: {
    variant: {
      user: "justify-end",
      assistant: "justify-start",
    },
  },
  defaultVariants: {
    variant: "assistant",
  },
});

const messageContentVariants = cva(
  "flex flex-col max-w-[80%] rounded-lg px-4 py-3 text-base font-sans",
  {
    variants: {
      variant: {
        user: "items-end bg-card text-card-foreground leading-6",
        assistant:
          "items-start bg-muted text-card-foreground font-medium leading-relaxed",
      },
    },
    defaultVariants: {
      variant: "assistant",
    },
  },
);

export interface MessageProps
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      | "onAnimationStart"
      | "onAnimationEnd"
      | "onAnimationIteration"
      | "onDrag"
      | "onDragEnd"
      | "onDragStart"
      | "onTouchStart"
      | "onTouchEnd"
      | "onTouchMove"
      | "onPointerDown"
      | "onPointerUp"
      | "onPointerMove"
      | "onPointerCancel"
      | "onPointerEnter"
      | "onPointerLeave"
    >,
    VariantProps<typeof messageVariants> {
  message: string;
  isStreaming?: boolean;
  submitted?: boolean;
}

function Message({
  className,
  variant,
  message,
  isStreaming = false,
  submitted = false,
  ...props
}: MessageProps) {
  return (
    <motion.div
      className={cn(messageVariants({ variant, className }))}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
        delay: variant === "user" ? 0.1 : 0.2,
      }}
      {...props}
    >
      <motion.div
        className={cn(messageContentVariants({ variant }))}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {variant === "assistant" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {submitted && (!message || message.trim() === "") ? (
              <motion.div
                className="flex items-center gap-2 text-muted-foreground animate-pulse"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex gap-2">
                  <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-0"></div>
                  <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-100"></div>
                  <div className="h-1 w-1 bg-muted-foreground rounded-full animate-bounce delay-200"></div>
                </div>
                <span className="text-sm animate-pulse">Thinking...</span>
              </motion.div>
            ) : (
              <>
                <MarkdownContent content={message} />
                {isStreaming && (
                  <motion.span
                    className="inline-block w-2 h-4 bg-primary ml-1"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="whitespace-pre-wrap font-sans"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {message}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export { Message, messageVariants, messageContentVariants };
