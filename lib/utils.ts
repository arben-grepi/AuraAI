import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function baseUrl() {
  return process.env.BETTER_AUTH_URL;
}

export function formatBytes(bytes: number) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Byte";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}

export function generateSlug(name: string) {
  return name.toLowerCase().replace(/ /g, "-");
}

export function generateChunks(
  input: string,
  maxChars = 1800, // ~450 tokens
  overlap = 300, // ~75 tokens
): string[] {
  if (!input) return [];

  // Normalize
  const text = input
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  // Split by high-signal section markers first (numbers, headings, dashes)
  const sectionSplits = text
    .split(/\n{2,}|(?:^|\n)\s*(?:\d+\.\s+|[-–—]{3,}|[A-Z][\w& ]+:\s*$)/m)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    const c = buf.trim();
    if (c.length >= 200 && !/^[\d\s\-–•.,;:()]+$/.test(c)) chunks.push(c);
    buf = "";
  };

  for (const sec of sectionSplits) {
    // Sentence-ish split (don’t over-split bullet lists)
    const parts = sec.split(/(?<=[.!?])\s+(?=[A-Z(“"'])/);
    for (const p of parts) {
      if ((buf + " " + p).length > maxChars) {
        const prev = buf;
        flush();
        // overlap tail from previous buffer
        const tail = prev.slice(Math.max(0, prev.length - overlap));
        buf = tail ? tail + " " + p : p;
      } else {
        buf = buf ? buf + " " + p : p;
      }
    }
    if (buf.length > maxChars * 0.9) flush();
  }
  if (buf) flush();

  // Ensure at least a couple of chunks if the doc is medium-sized
  if (chunks.length === 1 && chunks[0].length > maxChars * 1.2) {
    const mid = Math.floor(chunks[0].length / 2);
    return [chunks[0].slice(0, mid), chunks[0].slice(mid)];
  }
  return chunks;
}
