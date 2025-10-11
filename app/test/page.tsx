"use client";

import { File, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Page() {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ [key: string]: string }>(
    {},
  );
  const dragCounter = useRef(0);

  const allowedTypes = ["image/png", "application/pdf"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const MAX_FILES = 5;

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (!e.dataTransfer.types.includes("Files")) return;

      dragCounter.current += 1;
      setIsDragActive(true);
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault(); // allows drop
    };

    const onDragLeave = (_e: DragEvent) => {
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) {
        setIsDragActive(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragActive(false);
      const files = e.dataTransfer?.files;
      console.log(`File Count: ${files?.length}\n`);
      if (files) {
        for (const file of files) {
          console.log(`  File: ${file}, ${file.name}, ${file.size} bytes\n`);
          if (uploadedFiles.length >= MAX_FILES) {
            alert(`Maximum ${MAX_FILES} files allowed`);
            continue;
          }
          if (file.size > MAX_FILE_SIZE) {
            alert(
              `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
            );
            continue;
          }
          if (allowedTypes.includes(file.type)) {
            setUploadedFiles((prev) => [...prev, file]);
            if (file.type.startsWith("image/")) {
              const url = URL.createObjectURL(file);
              setFilePreviews((prev) => ({
                ...prev,
                [file.name]: url,
              }));
            }
          } else {
            alert(`Only ${allowedTypes.join(", ")} are allowed`);
          }
        }
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(filePreviews).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [filePreviews]);

  return (
    <div className="p-10 text-center relative min-h-screen">
      <div
        className={`inset-0 absolute m-8 border border-dashed border-blue-500 bg-black/50
                    flex items-center justify-center rounded pointer-events-none
                    ${isDragActive ? "block" : "hidden"}`}
      >
        Drag files here
      </div>

      <h1 className="text-xl font-semibold">Global Drag-and-Drop Demo</h1>
      <p>Try dragging a file from your desktop over this window.</p>

      {uploadedFiles.map((file, i) => (
        <div className="w-50 flex flex-col items-center border p-2" key={i}>
          <button
            onClick={() => {
              if (filePreviews[file.name]) {
                URL.revokeObjectURL(filePreviews[file.name]);
              }

              setUploadedFiles((prev) =>
                prev.filter((_, index) => index !== i),
              );
              setFilePreviews((prev) => {
                const newPreviews = { ...prev };
                delete newPreviews[file.name];
                return newPreviews;
              });
            }}
          >
            <X />
          </button>
          <p className="text-white">{file.name}</p>
          {filePreviews[file.name] ? (
            <img
              src={filePreviews[file.name]}
              alt={file.name}
              className="max-w-32 max-h-32 object-contain"
            />
          ) : (
            <File />
          )}
        </div>
      ))}
    </div>
  );
}
