"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [orgSlug, setOrgSlug] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (orgSlug.trim()) {
      formData.append("orgSlug", orgSlug.trim());
    }

    try {
      const response = await fetch("/api/files/rag", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to upload file", {
          description: `Status: ${response.status}`,
        });
        return;
      }

      toast.success("File uploaded successfully", {
        description: `${data.fileName} - ${data.chunksStored} chunks stored`,
      });
    } catch (error) {
      toast.error("Failed to upload file", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">RAG File Upload</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="file" className="text-sm font-medium">
            File (.txt or .pdf)
          </label>
          <input
            id="file"
            type="file"
            accept=".txt,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="orgSlug" className="text-sm font-medium">
            Organization Slug (optional)
          </label>
          <input
            id="orgSlug"
            type="text"
            placeholder="Leave empty to use active organization"
            value={orgSlug}
            onChange={(e) => setOrgSlug(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <p className="text-xs text-muted-foreground">
            If provided, this organization will be used instead of your active
            organization.
          </p>
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground rounded px-4 py-2 hover:bg-primary/90"
        >
          Upload
        </button>
      </form>
    </div>
  );
}
