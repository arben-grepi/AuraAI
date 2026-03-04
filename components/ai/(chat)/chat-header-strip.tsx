"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, MessageCircleDashed } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import type { Organization } from "@/lib/types";

export interface ChatHeaderStripProps {
  isAnonymous: boolean;
  onAnonymousChange: (value: boolean) => void;
  organization: Organization | null;
  session: { user: { name?: string | null } } | null;
  conversationId: string;
}

export function ChatHeaderStrip({
  isAnonymous,
  onAnonymousChange,
  organization,
  session,
  conversationId,
}: ChatHeaderStripProps) {
  const router = useRouter();

  const handleToggleAnonymous = () => {
    onAnonymousChange(!isAnonymous);
  };

  return (
    <div className="w-full h-fit py-2 mb-4 flex items-center justify-center sticky top-0 z-10 backdrop-blur">
      <AnimatePresence mode="wait">
        {isAnonymous ? (
          <motion.p
            className="text-xs font-medium text-zinc-800 ml-2"
            key="temp-header"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            layout
          >
            Tillfällig chatt
          </motion.p>
        ) : (
          <motion.div
            className="flex gap-2"
            key="anon-header"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            layout
          >
            <Image
              src={organization?.logo || "/logo.svg"}
              alt={organization?.name || "Organization Logo"}
              width={100}
              height={100}
              quality={100}
              className="rounded-sm object-fit"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute right-5 top-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full border cursor-pointer border-zinc-300 p-5 w-[42px] h-[42px] bg-zinc-100 flex items-center justify-center"
              aria-label="User menu"
            >
              {session?.user.name?.charAt(0)}
              {session?.user.name?.split(" ").slice(1).at(0)?.charAt(0)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <button
                type="button"
                className="text-sm cursor-pointer w-full flex items-center gap-2"
                onClick={() => {
                  void signOut();
                  router.push("/sign-in");
                }}
              >
                <LogOut className="size-4" />
                Logga ut
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="absolute right-18 top-3">
        <Button
          className="cursor-pointer rounded-full border-zinc-300 p-5 w-[42px] h-[42px] bg-zinc-100 flex items-center justify-center"
          variant="outline"
          size="icon"
          onClick={handleToggleAnonymous}
          disabled={!!conversationId}
          title={
            isAnonymous
              ? "Anonymt läge är aktiverat - klicka för att inaktivera"
              : "Anonymt läge är avstängt - klicka för att aktivera"
          }
          aria-label={
            isAnonymous ? "Inaktivera anonymt läge" : "Aktivera anonymt läge"
          }
        >
          <MessageCircleDashed className="size-4" />
        </Button>
      </div>
    </div>
  );
}
