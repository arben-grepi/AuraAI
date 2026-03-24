"use client";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConversationsSkeleton } from "./conversations-skeleton";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConvo } from "./delete-convo";
import { motion } from "motion/react";
import {
  Folder,
  FolderPlus,
  Loader,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createChatFolder,
  createConversation,
  deleteChatFolder,
  updateConversationFolder,
} from "@/lib/actions";
import { AnimatePresence } from "motion/react";

type ConversationStub = { id: string; title: string | null };
type ChatFolderStub = {
  id: string;
  name: string;
  conversations: ConversationStub[];
};
type ConversationsResponse = {
  folders: ChatFolderStub[];
  rootConversations: ConversationStub[];
};

export function Conversations({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [isDragOverNewFolder, setIsDragOverNewFolder] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async (): Promise<ConversationsResponse> => {
      const response = await fetch(`/api/ai/conversations`);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { folders: [], rootConversations: [] };
        }
        throw new Error("Failed to fetch conversations");
      }
      return response.json();
    },
  });

  const handleCreateFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    try {
      const result = await createChatFolder(name);
      if (result.success) {
        toast.success("Folder created");
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
        setIsFolderDialogOpen(false);
        setFolderName("");
      } else {
        toast.error(result.error || "Could not create folder");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create folder",
      );
    }
  };

  const toggleFolder = (id: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNewFolderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOverNewFolder(true);
  };

  const handleNewFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOverNewFolder(false);
    }
  };

  const handleNewFolderDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverNewFolder(false);
    const conversationId = e.dataTransfer.getData(DRAG_TYPE);
    if (!conversationId) return;
    try {
      const result = await updateConversationFolder(conversationId, null);
      if (result.success) {
        toast.success("Chat removed from folder");
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } else {
        toast.error(result.error || "Could not move");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move");
    }
  };

  if (isLoading) {
    return <ConversationsSkeleton />;
  }

  const folders = data?.folders ?? [];
  const rootConversations = data?.rootConversations ?? [];
  const isEmpty = rootConversations.length === 0 && folders.length === 0;

  return (
    <>
      <SidebarMenuItem className="min-w-0">
        <SidebarMenuButton
          className={cn(
            "cursor-pointer bg-white shadow-sm my-2 border border-sidebar-border rounded-md py-4.5",
            folders.length > 0 &&
              isDragOverNewFolder &&
              "ring-2 ring-primary/50 bg-primary/5",
          )}
          onClick={() => setIsFolderDialogOpen(true)}
          onDragOver={folders.length > 0 ? handleNewFolderDragOver : undefined}
          onDragLeave={
            folders.length > 0 ? handleNewFolderDragLeave : undefined
          }
          onDrop={folders.length > 0 ? handleNewFolderDrop : undefined}
        >
          <FolderPlus className="size-4" />
          <span>New folder</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <Dialog
        open={isFolderDialogOpen}
        onOpenChange={(open) => {
          setIsFolderDialogOpen(open);
          if (!open) setFolderName("");
        }}
      >
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">New folder</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Create a folder to organize your chats.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <label className="text-sm font-medium">Folder name</label>
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Work, Ideas"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateFolder();
                }
              }}
            />
          </div>
          <DialogFooter className="justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsFolderDialogOpen(false);
                setFolderName("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {folders.map((folder) => (
        <ChatFolderRow
          key={folder.id}
          id={folder.id}
          name={folder.name}
          conversations={folder.conversations}
          isExpanded={expandedFolderIds.has(folder.id)}
          onToggle={() => toggleFolder(folder.id)}
          slug={slug}
          folders={folders}
          onCreated={() =>
            queryClient.invalidateQueries({ queryKey: ["conversations"] })
          }
          onDeleted={() =>
            queryClient.invalidateQueries({ queryKey: ["conversations"] })
          }
          onMoved={() =>
            queryClient.invalidateQueries({ queryKey: ["conversations"] })
          }
        />
      ))}

      {rootConversations.map((convo) => (
        <div className="w-full min-w-0" key={convo.id}>
          <ConversationItem
            conversation={convo}
            slug={slug}
            folders={folders}
            onMoved={() =>
              queryClient.invalidateQueries({ queryKey: ["conversations"] })
            }
            acceptDropToRoot
          />
        </div>
      ))}

      {isEmpty && (
        <SidebarMenuItem className="min-w-0">
          <SidebarMenuButton disabled>
            <p>No chats found</p>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )}
    </>
  );
}

const DRAG_TYPE = "application/x-conversation-id";

const ConversationItem = ({
  conversation,
  slug,
  folders,
  onMoved,
  acceptDropToRoot,
}: {
  conversation: ConversationStub;
  slug: string;
  folders: ChatFolderStub[];
  onMoved: () => void;
  acceptDropToRoot?: boolean;
}) => {
  const pathname = usePathname();
  const isActive = pathname === `/org/${slug}/chat/${conversation.id}`;
  const [isDragOver, setIsDragOver] = useState(false);
  const [triggerVisible, setTriggerVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleDropdownOpenChange = useCallback((open: boolean) => {
    clearTimeout(closeTimerRef.current);
    if (open) {
      setTriggerVisible(true);
    } else {
      closeTimerRef.current = setTimeout(() => setTriggerVisible(false), 150);
    }
  }, []);

  const handleMoveTo = async (chatFolderId: string | null) => {
    const result = await updateConversationFolder(
      conversation.id,
      chatFolderId,
    );
    if (result.success) {
      toast.success("Conversation moved");
      onMoved();
    } else {
      toast.error(result.error || "Could not move");
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, conversation.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const conversationId = e.dataTransfer.getData(DRAG_TYPE);
    if (!conversationId) return;
    try {
      const result = await updateConversationFolder(conversationId, null);
      if (result.success) {
        toast.success("Chat removed from folder");
        onMoved();
      } else {
        toast.error(result.error || "Could not move");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move");
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={acceptDropToRoot ? handleRootDragOver : undefined}
      onDragLeave={acceptDropToRoot ? handleRootDragLeave : undefined}
      onDrop={acceptDropToRoot ? handleRootDrop : undefined}
      className={cn(
        "w-full min-w-0 group/conversation-row max-w-full flex justify-between items-center py-2 px-3 rounded-md transition-all duration-200 cursor-grab active:cursor-grabbing",
        isActive
          ? "bg-white font-normal border-sidebar-accent-foreground"
          : "hover:bg-sidebar-accent/50",
        acceptDropToRoot && isDragOver && "ring-2 ring-primary/50 bg-primary/5",
      )}
    >
      <Link
        href={`/org/${slug}/chat/${conversation.id}`}
        draggable={false}
        className={cn(
          "flex-1 truncate flex items-center gap-2 min-w-0 cursor-pointer",
        )}
      >
        <span className="truncate max-w-[200px] leading-5">
          {conversation.title || "New chat"}
        </span>
      </Link>
      <div
        className={cn(
          "shrink-0",
          triggerVisible ? "flex" : "group-hover/conversation-row:flex hidden",
        )}
      >
        <DropdownMenu onOpenChange={handleDropdownOpenChange}>
          <DropdownMenuTrigger className="items-center flex" asChild>
            <Button
              className="size-4 cursor-pointer hover:bg-sidebar-accent/50"
              variant="ghost"
              size="icon"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Move to folder</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleMoveTo(null)}>
                  No folder
                </DropdownMenuItem>
                {folders.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => handleMoveTo(f.id)}
                  >
                    {f.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DeleteConvo id={conversation.id} slug={slug} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

const ChatFolderRow = ({
  id,
  name,
  conversations,
  isExpanded,
  onToggle,
  slug,
  folders,
  onCreated,
  onDeleted,
  onMoved,
}: {
  id: string;
  name: string;
  conversations: ConversationStub[];
  isExpanded: boolean;
  onToggle: () => void;
  slug: string;
  folders: ChatFolderStub[];
  onCreated: () => void;
  onDeleted: () => void;
  onMoved: () => void;
}) => {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const conversationId = e.dataTransfer.getData(DRAG_TYPE);
    if (!conversationId) return;
    try {
      const result = await updateConversationFolder(conversationId, id);
      if (result.success) {
        toast.success("Chat moved to folder");
        onMoved();
      } else {
        toast.error(result.error || "Failed to move");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move");
    }
  };

  const handleNewChatInFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsCreating(true);
      const { success, data, error } = await createConversation(id);
      if (success && data?.id) {
        onCreated();
        toast.success("Chat created");
        router.push(`/org/${slug}/chat/${data.id}`);
      } else {
        toast.error(error || "Could not create chat");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create chat",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsDeleting(true);
      const result = await deleteChatFolder(id);
      if (result.success) {
        toast.success("Folder removed");
        onDeleted();
      } else {
        toast.error(result.error || "Could not remove folder");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove folder",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full min-w-0 rounded-md my-2">
      <div
        className={cn(
          "w-full min-w-0 flex items-center gap-1 py-2 px-2 rounded-md transition-all duration-200 cursor-pointer",
          isDragOver && "ring-2 ring-primary/50 bg-primary/5",
        )}
        onClick={onToggle}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* <button
          type="button"
          className="p-0.5 rounded hover:bg-sidebar-accent/50 transition-colors shrink-0"
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
        >
          {isExpanded ? (
            <ChevronDown className="size-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3 text-muted-foreground" />
          )}
        </button> */}
        <div className="w-6 h-6 rounded flex justify-center items-center shrink-0">
          <Folder className="size-4" />
        </div>
        <div className="flex-1 min-w-0 select-none">
          <p className="text-sm truncate">{name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </div>
      <AnimatePresence mode="wait">
        {isExpanded && (
          <motion.div
            initial={{ gridTemplateRows: "0fr", opacity: 0 }}
            animate={{ gridTemplateRows: "1fr", opacity: 1 }}
            exit={{ gridTemplateRows: "0fr", opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="grid overflow-hidden select-none"
          >
            <div className="min-h-0 min-w-0 bg-neutral-200 rounded-md ml-4 mr-4 py-2 px-2 overflow-hidden">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No chats in this folder
                </p>
              ) : (
                conversations.map((convo) => (
                  <ConversationItem
                    key={convo.id}
                    conversation={convo}
                    slug={slug}
                    folders={folders}
                    onMoved={onMoved}
                  />
                ))
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start cursor-pointer gap-2 text-muted-foreground hover:text-foreground mt-1"
                onClick={handleNewChatInFolder}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                New chat in this folder
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
