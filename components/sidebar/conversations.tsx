"use client";

import { Conversation } from "@/app/generated/prisma";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ConversationsSkeleton } from "./conversations-skeleton";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageSquare, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { DeleteConvo } from "./delete-convo";

export function Conversations() {
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/conversations`,
      );
      return response.json();
    },
    gcTime: 1000 * 60 * 5,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <ConversationsSkeleton />;
  }

  return (
    <>
      {data && data.length > 0 ? (
        data.map((convo: Conversation) => (
          <div className="w-full" key={convo.id}>
            <ConversationItem conversation={convo} />
          </div>
        ))
      ) : (
        <SidebarMenuItem>
          <SidebarMenuButton disabled>
            <p>No conversations found</p>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    </>
  );
}

const ConversationItem = ({ conversation }: { conversation: Conversation }) => {
  const pathname = usePathname();
  const isActive = pathname === `/chat/${conversation.id}`;

  return (
    <div
      className={cn(
        "w-full flex justify-between items-center py-2 px-3 rounded-md transition-all duration-200 group cursor-pointer",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
      )}
    >
      <Link
        href={`/chat/${conversation.id}`}
        className={cn(
          "flex-1 truncate flex items-center gap-2 min-w-0 cursor-pointer",
          isActive && "text-sidebar-accent-foreground",
        )}
      >
        <MessageSquare className={cn("h-3 w-3 flex-shrink-0")} />
        <span className="truncate">{conversation.title}</span>
      </Link>
      <div className="flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="items-center flex" asChild>
            <Button
              className="size-4 cursor-pointer hover:bg-sidebar-accent/50"
              variant="ghost"
              size="icon"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DeleteConvo id={conversation.id} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
