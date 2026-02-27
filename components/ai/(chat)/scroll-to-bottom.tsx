"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown } from "lucide-react";
import { useStickToBottomContext } from "use-stick-to-bottom";

/**
 * Floating button that appears when the user has scrolled up, to scroll back to the bottom.
 */
export function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.button
          key="scroll-button"
          className="absolute bottom-8 left-1/2 cursor-pointer transform -translate-x-1/2 z-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-2 shadow-lg"
          onClick={() => scrollToBottom()}
          title="Scroll to bottom"
          initial={{ opacity: 0, y: 0, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 0, scale: 0.8 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowDown className="size-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
