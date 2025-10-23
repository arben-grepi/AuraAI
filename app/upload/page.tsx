"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export default function Page() {
  const [file, setFile] = useState<File | null | undefined>(null);
  const [url, setUrl] = useState<string | null>(null);
  const handleSubmit = async () => {
    try {
      const formData = new FormData();
      if (!file) return;
      formData.append("file", file);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }
      const data = await response.json();
      setUrl(data.url);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <div>
      {url && <a href={url}>File URL: {url}</a>}
      <Input onChange={(e) => setFile(e.target.files?.[0])} type="file" />
      <Button onClick={handleSubmit}>Upload</Button>
    </div>
  );
}
