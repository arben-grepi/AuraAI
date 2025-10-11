"use client";

import { useUploadFiles } from "better-upload/client";
import { UploadDropzone } from "@/components/ui/upload-dropzone";
import { toast } from "sonner";
import { useEffect } from "react";

export function Uploader({
  onUploadComplete,
  onPendingChange,
}: {
  onUploadComplete?: (fileUrls: string[]) => void;
  onPendingChange?: (isPending: boolean) => void;
}) {
  const { control, isPending } = useUploadFiles({
    route: "upload",
    onUploadComplete: ({ files }) => {
      const fileUrls = files.map((file) => {
        const bucketName = process.env.NEXT_PUBLIC_AWS_S3_BUCKET || "kommun-ai";
        const region = process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1";
        return `https://${bucketName}.s3.${region}.amazonaws.com/${file.objectKey}`;
      });
      toast.success(
        `${files.length} file${files.length === 1 ? " was" : "s were"} uploaded`,
      );
      onUploadComplete?.(fileUrls);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  return (
    <UploadDropzone
      control={control}
      accept="image/*"
      description={{
        maxFiles: 1,
        maxFileSize: "5MB",
        fileTypes: "JPEG, PNG, GIF",
      }}
    />
  );
}
