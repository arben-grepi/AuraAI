"use client";

import { CircleArrowUp, File, Trash2, Upload, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { toast } from "sonner";
import TagInput from "./tag-input";
import { deleteResource } from "@/lib/actions";

const filters = [
  {
    label: "Analytics",
    value: "analytics",
  },
  {
    label: "Marketing",
    value: "marketing",
  },
  {
    label: "Sales",
    value: "sales",
  },
  {
    label: "Customer Support",
    value: "customer-support",
  },
  {
    label: "Product",
    value: "product",
  },
];

export default function OrgFilesList({ orgId }: { orgId: string }) {
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["files"],
    queryFn: () => getFiles(orgId),
  });

  const handleChangeFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error(
          `${selectedFile.name} is too large. Maximum file size is 10MB`,
        );
        return;
      }
      setFile(selectedFile);
      toast.success(`File selected: ${selectedFile.name}`);
      event.target.value = "";
    }
  };

  const handleResetForm = () => {
    setFile(null);
    setSelected([]);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      handleResetForm();
    }
  };

  const handleUploadFile = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tags", JSON.stringify(selected));
      formData.append("orgId", orgId);

      const response = await fetch(`/api/files/rag`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload file");
      }

      await response.json();
      toast.success("File uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["files"] });
      handleResetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error uploading file", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload file",
      );
    }
  };

  return (
    <div className="border border-zinc-200 rounded-[12px] mt-10">
      <div className="border-b border-zinc-200 p-7 flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <p className="font-medium text-sm">Uploaded Files</p>
          <p className="text-zinc-600 text-sm font-medium">
            Some placeholder text here
          </p>
        </div>
        <div className="flex gap-2">
          <Input className="relative py-5" placeholder="Search files"></Input>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="w-fit py-5 rounded-[10px] cursor-pointer">
                <p>Upload file</p>
                <Upload className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[526px]">
              <DialogHeader className="gap-1">
                <DialogTitle className="text-sm font-medium">
                  Upload file
                </DialogTitle>
                <DialogDescription className="text-zinc-600 text-sm font-medium">
                  Upload a file to the organization
                </DialogDescription>
              </DialogHeader>
              <div className="h-px bg-zinc-200 w-full"></div>
              <input
                type="file"
                onChange={handleChangeFiles}
                accept="application/pdf,text/plain,.txt"
                className="hidden"
                ref={fileInputRef}
              />
              {file && (
                <div className="flex gap-2 overflow-x-auto pb-4">
                  <div className="shadow-sm relative group flex gap-1 p-2 bg-zinc-100 rounded-[8px] max-w-[202px]">
                    <div className="bg-neutral-100 flex items-center justify-center">
                      <File />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium truncate max-w-[140px]">
                        {file.name}
                      </p>
                      <p className="text-xs text-zinc-500 font-medium">
                        {file.type}
                      </p>
                    </div>
                    <X
                      className="size-4 bg-white rounded-full group-hover:block hidden transition-all duration-200 cursor-pointer absolute top-1 right-1 hover:text-zinc-500"
                      onClick={() => setFile(null)}
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium">Choose your file</p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-zinc-300 border-dashed w-full rounded-[12px] min-h-[230px] mt-1 flex items-center justify-center flex-col gap-2 text-center hover:bg-zinc-100 transition-all duration-200 cursor-pointer"
                >
                  <CircleArrowUp />
                  <p className="text-sm font-medium">
                    Click to upload
                    <span className="text-zinc-500">
                      or drag and drop a file
                      <br /> docx. xsxl. pdf. md. txt. (Max 10mb)
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Tags (optional)</p>
                <TagInput selected={selected} setSelected={setSelected} />
              </div>
              <DialogFooter className="justify-end">
                <Button
                  variant="outline"
                  className="w-fit py-5 rounded-[10px] cursor-pointer"
                  onClick={() => {
                    setIsDialogOpen(false);
                    handleResetForm();
                  }}
                >
                  <p>Cancel</p>
                </Button>
                <Button
                  onClick={handleUploadFile}
                  className="w-fit py-5 rounded-[10px] cursor-pointer"
                >
                  <p>Upload</p>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="py-3.5 px-7">
        <p className="text-sm font-medium block">Filter</p>
        <div className="flex gap-2 mt-1">
          {filters.map((filter) => (
            <div
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "rounded-full border border-zinc-200 py-[6px] px-[10px] shadow-xs cursor-pointer transition-all duration-200",
                activeFilter === filter.value
                  ? "bg-primary !text-white"
                  : "bg-transparent !text-zinc-800",
              )}
            >
              <p className="font-medium text-sm">{filter.label}</p>
            </div>
          ))}
        </div>
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
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <FileItemSkeleton key={index} />
                ))
              : data?.map((file: OrgFile) => (
                  <ListItem
                    key={file.id}
                    id={file.id}
                    name={file.name}
                    tags={file.tags}
                  />
                ))}
            {data?.length === 0 && (
              <div className="w-full py-4 px-2.5 rounded-[12px] border-b border-zinc-100 flex  items-center justify-center cursor-pointer hover:bg-zinc-100 transition-all duration-200">
                <p className="text-sm font-medium">No files found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ListItem = ({
  id,
  name,
  tags,
}: {
  id: string;
  name: string;
  tags: string[];
}) => {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const deletion = await deleteResource(id);
      if (deletion.success) {
        toast.success(deletion.data?.data || "Resource deleted");
        queryClient.invalidateQueries({ queryKey: ["files"] });
      } else {
        toast.error(deletion.error || "Failed to delete resource");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete resource",
      );
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <div className="w-full py-4 px-2.5 rounded-[12px] border-b border-zinc-100 flex  items-center cursor-pointer hover:bg-zinc-100 transition-all duration-200">
      <div className="flex gap-2.5 flex-1">
        <div className="w-10.5 h-10.5 rounded-[8px] bg-zinc-100 flex justify-center items-center">
          <File className="" />
        </div>
        <div className="flex flex-col justify-between">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-zinc-500 font-medium">200KB</p>
        </div>
      </div>
      <div className="flex gap-2 flex-1">
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
          Remove
          <Trash2 />
        </Button>
      </div>
    </div>
  );
};

const FileItemSkeleton = () => {
  return (
    <div className="w-full py-4 px-2.5 rounded-[12px] animate-pulse  border-b border-zinc-100 flex  items-center cursor-pointer hover:bg-zinc-100 transition-all duration-200">
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

const getFiles = async (orgId: string) => {
  const files = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/org/files?orgId=${orgId}`,
  );
  const data = await files.json();
  return data;
};

type OrgFile = {
  id: string;
  name: string;
  tags: string[];
};
