"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleArrowUp,
  ExternalLink,
  File,
  Folder,
  FolderPlus,
  Loader,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { toast } from "sonner";
import TagInput from "./tag-input";
import {
  createFileFolder,
  deleteFileFolder,
  deleteResource,
} from "@/lib/actions";

type FileItem = { file: File; sensitive: boolean };

type RecoveryState = {
  failedItems: FileItem[];
  errorMessage: string;
};

export default function OrgFilesList({ orgId }: { orgId: string }) {
  const itemsPerPage = 10;
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState<boolean>(false);
  const [folderName, setFolderName] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [recoveryState, setRecoveryState] = useState<RecoveryState | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 800);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const { data, isLoading } = useQuery({
    queryKey: ["files", orgId, currentPage, itemsPerPage, searchTerm],
    queryFn: () => getFiles(orgId, currentPage, itemsPerPage, searchTerm),
    placeholderData: (previousData) => previousData,
  });

  const listEntries = useMemo<ListEntry[]>(() => {
    if (!data) return [];
    const fileEntries = data.rootFiles.map(
      (file): ListEntry => ({ kind: "file", file }),
    );
    const folderEntries = data.folders.map(
      (folder): ListEntry => ({ kind: "folder", folder }),
    );
    return [...fileEntries, ...folderEntries];
  }, [data]);

  const totalItems = data?.pagination.totalItems ?? 0;
  const totalPages = data?.pagination.totalPages ?? currentPage;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);


  const processSelectedFiles = (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;
    const validFiles: File[] = [];
    const skippedFiles: string[] = [];

    selectedFiles.forEach((selectedFile) => {
      if (selectedFile.size > 10 * 1024 * 1024) {
        skippedFiles.push(selectedFile.name);
        return;
      }
      validFiles.push(selectedFile);
    });

    if (skippedFiles.length) {
      toast.error(
        `${skippedFiles.length} file${skippedFiles.length === 1 ? "" : "s"} skipped (max size is 10 MB)`,
      );
    }
    if (!validFiles.length) return;

    setFileItems((prev) => [
      ...prev,
      ...validFiles.map((file) => ({ file, sensitive: false })),
    ]);
    toast.success(
      `${validFiles.length} file${validFiles.length === 1 ? "" : "s"} selected`,
    );
  };

  const handleChangeFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    processSelectedFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    processSelectedFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const toggleFileSensitive = (index: number) => {
    setFileItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, sensitive: !item.sensitive } : item,
      ),
    );
  };

  const removeFile = (index: number) => {
    setFileItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleResetForm = () => {
    setFileItems([]);
    setSelected([]);
    setSelectedFolderId("");
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) handleResetForm();
  };

  type FailedUpload = { item: FileItem; message: string; errorCode?: string };

  const uploadItems = useCallback(
    async (
      items: FileItem[],
    ): Promise<{ uploadedCount: number; failures: FailedUpload[] }> => {
      let uploadedCount = 0;
      const failures: FailedUpload[] = [];

      for (const item of items) {
        try {
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("tags", JSON.stringify(selected));
          formData.append("orgId", orgId);
          formData.append("sensitive", String(item.sensitive));
          if (selectedFolderId) formData.append("fileFolderId", selectedFolderId);

          const response = await fetch(`/api/files/rag`, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            failures.push({
              item,
              message: errorData.error || "Failed to upload file",
              errorCode: errorData.errorCode ?? undefined,
            });
            continue;
          }

          await response.json();
          uploadedCount += 1;
        } catch (error) {
          console.error(`Error uploading "${item.file.name}"`, error);
          failures.push({
            item,
            message:
              error instanceof Error ? error.message : "Failed to upload file",
          });
        }
      }

      return { uploadedCount, failures };
    },
    [orgId, selected, selectedFolderId],
  );

  const applyUploadResult = useCallback(
    (
      uploadedCount: number,
      failures: FailedUpload[],
      successLabel?: string,
    ): boolean => {
      if (uploadedCount > 0) {
        toast.success(
          successLabel ??
            `${uploadedCount} file${uploadedCount === 1 ? "" : "s"} uploaded successfully`,
        );
        queryClient.invalidateQueries({ queryKey: ["files"] });
      }

      if (failures.length > 0) {
        const ollamaFail = failures.find(
          (f) => f.errorCode === "OLLAMA_UNAVAILABLE",
        );

        if (ollamaFail) {
          setRecoveryState({
            failedItems: failures.map((f) => f.item),
            errorMessage: ollamaFail.message ?? "Ollama not reachable",
          });
          return false;
        }

        const uniqueErrors = [...new Set(failures.map((f) => f.message))];
        for (const msg of uniqueErrors) toast.error(msg);
        setFileItems(failures.map((f) => f.item));
        return false;
      }

      return true;
    },
    [queryClient],
  );

  const handleUploadFile = async () => {
    if (!fileItems.length) {
      toast.error("Please select at least one file");
      return;
    }
    setIsUploading(true);
    try {
      const { uploadedCount, failures } = await uploadItems(fileItems);
      const allDone = applyUploadResult(uploadedCount, failures);
      if (allDone) {
        handleResetForm();
        setIsDialogOpen(false);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload file",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    try {
      const result = await createFileFolder(orgId, name);
      if (result.success) {
        toast.success("Folder created");
        queryClient.invalidateQueries({ queryKey: ["files"] });
        setIsFolderDialogOpen(false);
        setFolderName("");
      } else {
        toast.error(result.error || "Failed to create folder");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create folder",
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

  return (
    <>
      {/* Recovery modal — shown outside the upload dialog so it layers on top */}
      {recoveryState && (
        <Dialog open={true} onOpenChange={() => setRecoveryState(null)}>
          <DialogContent className="max-w-[480px]">
            <DialogHeader>
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2">
                <ShieldAlert className="size-5 text-red-600" />
              </div>
              <DialogTitle className="text-sm font-semibold">
                On-premise AI not reachable
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-600">
                Ollama could not be reached — embeddings could not be generated for{" "}
                {recoveryState.failedItems.length} file{recoveryState.failedItems.length === 1 ? "" : "s"}.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 mt-2">
              {/* Start Ollama */}
              <div className="flex items-start gap-3 p-3 border border-zinc-200 rounded-[10px] bg-zinc-50">
                <div className="w-8 h-8 rounded-[8px] bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="size-4 text-green-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Start Ollama</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Run <code className="bg-zinc-200 px-1 rounded">ollama serve</code> on
                    the server, then retry the upload.
                  </p>
                </div>
              </div>

              <a
                href="https://ollama.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border border-zinc-200 rounded-[10px] hover:bg-zinc-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-[8px] bg-zinc-100 flex items-center justify-center shrink-0">
                  <ExternalLink className="size-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Ollama documentation</p>
                  <p className="text-xs text-zinc-500">
                    Install and configure the on-premise AI model
                  </p>
                </div>
                <ExternalLink className="size-3.5 text-zinc-400 shrink-0" />
              </a>
            </div>

            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setRecoveryState(null)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="border border-zinc-200 rounded-[12px] mt-10">
        <div className="border-b border-zinc-200 p-7 flex justify-between items-center">
          <div className="flex flex-col gap-2">
            <p className="font-medium text-sm">Uploaded files</p>
            <p className="text-zinc-600 text-sm font-medium">
              Manage files used in the organization&apos;s AI knowledge base.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              className="relative py-5"
              placeholder="Search files"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="w-fit py-5 rounded-[10px] cursor-pointer">
                  <p>Upload file</p>
                  <Upload className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[540px] gap-0 p-0 overflow-hidden">
                {/* Pinned header */}
                <div className="shrink-0 px-6 pt-6 pb-4">
                  <DialogHeader className="gap-1">
                    <DialogTitle className="text-sm font-medium">
                      Upload files
                    </DialogTitle>
                    <DialogDescription className="text-zinc-600 text-sm font-medium">
                      Select files and choose which ones contain sensitive data.
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="h-px bg-zinc-200 w-full shrink-0" />

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-4">
                  <input
                    type="file"
                    onChange={handleChangeFiles}
                    accept="application/pdf,text/plain,.txt,.md,.csv,.json,.html,.xml,.docx,.xlsx"
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                  />

                  {/* Per-file stack */}
                  {fileItems.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {fileItems.map((item, index) => (
                        <div
                          key={`${item.file.name}-${item.file.size}-${item.file.lastModified}-${index}`}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-[10px] border transition-colors",
                            item.sensitive
                              ? "border-amber-300 bg-amber-50"
                              : "border-zinc-200 bg-zinc-50",
                          )}
                        >
                          <div className="w-8 h-8 rounded-[6px] bg-white border border-zinc-200 flex items-center justify-center shrink-0">
                            <File className="size-4 text-zinc-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.file.name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {(item.file.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleFileSensitive(index)}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors shrink-0 border",
                              item.sensitive
                                ? "border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200"
                                : "border-zinc-200 bg-white text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100",
                            )}
                            title={
                              item.sensitive
                                ? "Marked sensitive — processed by on-premise AI only"
                                : "Mark as sensitive"
                            }
                          >
                            <ShieldCheck className="size-3" />
                            <span>Sensitive</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
                            title="Remove file"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Drop zone */}
                  <div>
                    <p className="text-sm font-medium">Add files</p>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={cn(
                        "border border-dashed w-full rounded-[12px] min-h-[120px] mt-1 flex items-center justify-center flex-col gap-2 text-center transition-all duration-200 cursor-pointer",
                        isDragging
                          ? "border-primary bg-primary/5"
                          : "border-zinc-300 hover:bg-zinc-100",
                      )}
                    >
                      <CircleArrowUp className="size-5 text-zinc-400" />
                      <p className="text-sm font-medium">
                        Click to upload
                        <span className="text-zinc-500">
                          {" "}
                          or drag and drop
                          <br />
                          PDF · DOCX · XLSX · TXT · MD (max 10 MB)
                        </span>
                      </p>
                    </div>
                  </div>

                  {fileItems.some((i) => i.sensitive) && (
                    <div className="flex items-start gap-2 p-3 rounded-[10px] bg-amber-50 border border-amber-200 text-xs text-amber-700">
                      <ShieldCheck className="size-3.5 mt-0.5 shrink-0" />
                      <span>
                        Sensitive files will be processed only by the
                        on-premise AI model — never sent to the cloud.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Folder (optional)</p>
                    <select
                      value={selectedFolderId}
                      onChange={(e) => setSelectedFolderId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
                    >
                      <option value="">Root (no folder)</option>
                      {data?.folderOptions?.map((f: FolderOption) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Tags (optional)</p>
                    <TagInput selected={selected} setSelected={setSelected} />
                  </div>
                </div>

                {/* Pinned footer */}
                <div className="shrink-0 px-6 py-4 border-t border-zinc-100">
                  <DialogFooter className="justify-end">
                    <Button
                      variant="outline"
                      className="w-fit py-5 rounded-[10px] cursor-pointer"
                      onClick={() => {
                        setIsDialogOpen(false);
                        handleResetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUploadFile}
                      className="w-fit py-5 rounded-[10px] cursor-pointer"
                      disabled={isUploading || fileItems.length === 0}
                    >
                      {isUploading ? (
                        <Loader className="size-4 animate-spin" />
                      ) : (
                        `Upload${fileItems.length > 0 ? ` (${fileItems.length})` : ""}`
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog
              open={isFolderDialogOpen}
              onOpenChange={(open) => {
                setIsFolderDialogOpen(open);
                if (!open) setFolderName("");
              }}
            >
              <DialogTrigger asChild>
                <Button className="w-fit py-5 rounded-[10px] cursor-pointer">
                  <p>Create folder</p>
                  <FolderPlus className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[400px]">
                <DialogHeader>
                  <DialogTitle className="text-sm font-medium">
                    New folder
                  </DialogTitle>
                  <DialogDescription className="text-zinc-600 text-sm">
                    Create a folder to organize your files.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2 py-2">
                  <label className="text-sm font-medium">Folder name</label>
                  <Input
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g. Finance, Reports"
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
                  <Button
                    onClick={handleCreateFolder}
                    disabled={!folderName.trim()}
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="py-3.5 px-7">
          <div className="flex flex-col gap-2 w-full mt-5">
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-500 font-medium">NAME</p>
              <p className="text-xs text-zinc-500 font-medium">TAG</p>
              <Button className="bg-destructive/10 appearance-none! opacity-0 pointer-events-none text-destructive cursor-pointer hover:bg-destructive/20 transition-all duration-200">
                Remove
                <Trash2 />
              </Button>
            </div>
            <div className="flex flex-col w-full">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <FileItemSkeleton key={index} />
                ))
              ) : (
                <>
                  {listEntries.map((entry) =>
                    entry.kind === "file" ? (
                      <ListItem
                        key={entry.file.id}
                        id={entry.file.id}
                        name={entry.file.name}
                        tags={entry.file.tags}
                        sensitive={entry.file.sensitive}
                      />
                    ) : (
                      <FolderRow
                        key={entry.folder.id}
                        id={entry.folder.id}
                        name={entry.folder.name}
                        resources={entry.folder.resources}
                        isExpanded={expandedFolderIds.has(entry.folder.id)}
                        onToggle={() => toggleFolder(entry.folder.id)}
                      />
                    ),
                  )}
                  {!isLoading && totalItems === 0 && (
                    <div className="w-full py-4 px-2.5 rounded-[12px] border-b border-zinc-100 flex items-center justify-center cursor-pointer hover:bg-zinc-100 transition-all duration-200">
                      <p className="text-sm font-medium">
                        No files or folders yet
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            {!isLoading && totalItems > 0 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <p className="text-xs text-zinc-500 font-medium mr-2">
                  Page {currentPage} of {totalPages}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCurrentPage((p) => Math.max(1, p - 1))
                  }
                  disabled={currentPage === 1}
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setCurrentPage((p) =>
                      p < totalPages ? p + 1 : p,
                    )
                  }
                  disabled={currentPage >= totalPages}
                  aria-label="Go to next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const ListItem = ({
  id,
  name,
  tags,
  sensitive,
}: {
  id: string;
  name: string;
  tags: string[];
  sensitive: boolean;
}) => {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const deletion = await deleteResource(id);
      if (deletion.success) {
        toast.success(deletion.data?.data || "File deleted");
        queryClient.invalidateQueries({ queryKey: ["files"] });
      } else {
        toast.error(deletion.error || "Failed to delete file");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete file",
      );
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <div className="w-full py-4 px-2.5 rounded-[12px] border-b border-zinc-100 flex items-center cursor-pointer hover:bg-zinc-100 transition-all duration-200">
      <div className="flex gap-2.5 flex-1">
        <div className="w-10.5 h-10.5 shrink-0 rounded-[8px] bg-zinc-100 flex justify-center items-center">
          <File className="" />
        </div>
        <div className="flex flex-col justify-between">
          <p className="text-sm font-medium line-clamp-1">{name}</p>
          <p className="text-xs text-zinc-500 font-medium">200KB</p>
        </div>
      </div>
      <div className="flex gap-2 flex-1 flex-wrap">
        {sensitive && (
          <div className="flex items-center gap-1 rounded-[12px] bg-amber-50 border border-amber-300 px-2.5 py-1">
            <ShieldCheck className="size-3 text-amber-600" />
            <p className="text-xs font-medium text-amber-700">Sensitive</p>
          </div>
        )}
        {tags.map((tag) => (
          <div
            key={tag}
            className="rounded-[12px] bg-transparent border border-zinc-200 px-2.5 py-1"
          >
            <p className="text-xs font-medium">{tag}</p>
          </div>
        ))}
      </div>
      <div className="">
        <Button
          className="bg-destructive/10 text-destructive cursor-pointer hover:bg-destructive/20 transition-all duration-200"
          onClick={handleDelete}
        >
          {isDeleting ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <div className="flex items-center gap-2">
              Remove
              <Trash2 />
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

const FileItemSkeleton = () => {
  return (
    <div className="w-full py-4 px-2.5 rounded-[12px] animate-pulse border-b border-zinc-100 flex items-center cursor-pointer hover:bg-zinc-100 transition-all duration-200">
      <div className="flex gap-2.5 flex-1">
        <div className="w-10.5 h-10.5 rounded-[8px] bg-zinc-300 flex justify-center items-center"></div>
        <div className="flex flex-col justify-between">
          <div className="w-20 h-4 bg-zinc-300 rounded-[4px]"></div>
          <div className="w-10 h-3 bg-zinc-300 rounded-[4px]"></div>
        </div>
      </div>
      <div className="flex gap-2 flex-1">
        <div className="w-10 h-4 bg-zinc-300 rounded-[4px]"></div>
      </div>
    </div>
  );
};

const FolderRow = ({
  id,
  name,
  resources,
  isExpanded,
  onToggle,
}: {
  id: string;
  name: string;
  resources: OrgFile[];
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsDeleting(true);
      const result = await deleteFileFolder(id);
      if (result.success) {
        toast.success(result.data?.data || "Folder deleted");
        queryClient.invalidateQueries({ queryKey: ["files"] });
      } else {
        toast.error(result.error || "Failed to delete folder");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete folder",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="border-b border-zinc-100">
      <div
        className="w-full py-4 px-2.5 rounded-[12px] flex items-center cursor-pointer hover:bg-zinc-100 transition-all duration-200"
        onClick={onToggle}
      >
        <button
          type="button"
          className="p-0.5 rounded hover:bg-zinc-200 transition-colors mr-1.5"
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
        >
          {isExpanded ? (
            <ChevronDown className="size-4 text-zinc-500" />
          ) : (
            <ChevronRight className="size-4 text-zinc-500" />
          )}
        </button>
        <div className="w-10.5 h-10.5 rounded-[8px] bg-amber-100 flex justify-center items-center shrink-0">
          <Folder className="size-5 text-amber-700" />
        </div>
        <div className="flex flex-col justify-between ml-2.5 flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-zinc-500 font-medium">
            {resources.length} file{resources.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          className="bg-destructive/10 text-destructive shrink-0 cursor-pointer hover:bg-destructive/20 transition-all duration-200"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader className="size-4 animate-spin" />
          ) : (
            <div className="flex items-center gap-2">
              Remove
              <Trash2 className="size-4" />
            </div>
          )}
        </Button>
      </div>
      {isExpanded && (
        <div className="pl-6 pr-2.5 pb-1">
          {resources.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3">No files in this folder</p>
          ) : (
            resources.map((file) => (
              <ListItem
                key={file.id}
                id={file.id}
                name={file.name}
                tags={file.tags}
                sensitive={file.sensitive}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const getFiles = async (
  orgId: string,
  page: number,
  limit: number,
  search: string,
): Promise<FilesResponse> => {
  const params = new URLSearchParams({
    orgId,
    page: page.toString(),
    limit: limit.toString(),
  });
  if (search) params.set("search", search);
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/org/files?${params.toString()}`,
  );
  return res.json();
};

type OrgFile = {
  id: string;
  name: string;
  tags: string[];
  sensitive: boolean;
};

type OrgFolder = {
  id: string;
  name: string;
  resources: OrgFile[];
};

type FilesResponse = {
  folders: OrgFolder[];
  rootFiles: OrgFile[];
  folderOptions: FolderOption[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  search: string;
};

type FolderOption = {
  id: string;
  name: string;
};

type ListEntry =
  | { kind: "file"; file: OrgFile }
  | { kind: "folder"; folder: OrgFolder };
