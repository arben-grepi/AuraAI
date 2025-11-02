"use client";

import { Organization } from "better-auth/plugins";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { organization } from "@/lib/auth-client";
import { generateSlug } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

export default function General({ org }: { org: Organization }) {
  const [name, setName] = useState<string>(org.name);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [logo, setLogo] = useState<string>(org.logo || "");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const hasChanges = name !== org.name || logo !== (org.logo || "");

  const handleCancel = () => {
    setName(org.name);
    setLogo(org.logo || "");
  };
  const handleUploadLogo = async () => {
    const file = logoInputRef.current?.files?.[0];
    if (file) {
      setIsUploading(true);
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Logo size should be less than 5MB");
        setIsUploading(false);
        return;
      }
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        toast.error("Logo type should be JPEG or PNG");
        setIsUploading(false);
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        toast.error("Failed to upload logo");
        setIsUploading(false);
        return;
      }
      const data = await response.json();
      setLogo(data.url || "");
      toast.success("Logo uploaded successfully");
      setIsUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    await organization.update({
      data: {
        name,
        logo,
        slug: generateSlug(name),
      },
      organizationId: org.id,
    });
    toast.success("Changes saved successfully");
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
    router.push(`/admin/org/${generateSlug(name)}`);
  };
  return (
    <div>
      <div className="w-full flex justify-between px-8 py-10 border-b border-zinc-200">
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-xl">Organization Information</h1>
          <p className="text-base text-zinc-600">
            {hasChanges ? (
              <span className="text-amber-600">Unsaved changes</span>
            ) : (
              "Some placeholder text"
            )}
          </p>
        </div>
        <div className="flex gap-3">
          {hasChanges && (
            <Button
              variant={"ghost"}
              className="w-fit py-5"
              onClick={handleCancel}
              disabled={isUploading}
            >
              Cancel
            </Button>
          )}
          <Button
            variant={"outline"}
            className="w-fit py-5"
            onClick={handleSaveChanges}
            disabled={isUploading || !hasChanges}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-10 px-8 py-10">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Organization Name</Label>
          <Input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input min-w-[300px] max-w-[300px]"
            placeholder="Organization Name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="logo">Organization Logo</Label>
          <div className="border border-zinc-200 rounded-[12px] bg-white w-[238px] h-[178px] flex flex-col">
            <div className="flex-1 relative flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Image
                  className="object-cover"
                  src={logo || "/placeholder.svg"}
                  alt="Organization Logo"
                  width={100}
                  height={100}
                />
              )}
            </div>
            <div
              onClick={() => {
                if (isUploading) return;
                logoInputRef.current?.click();
              }}
              className={`${isUploading ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} flex items-center justify-center gap-2 py-3 border-t border-zinc-200`}
            >
              <p className="text-sm text-zinc-800 font-medium">Upload logo</p>
              <input
                id="logo-input"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleUploadLogo}
                ref={logoInputRef}
              />
              <Upload className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
