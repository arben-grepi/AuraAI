import type { ChatFilePart } from "./types";
import type { UploadedAttachment } from "./types";

export function attachmentsToChatFileParts(
  attachments: UploadedAttachment[],
): ChatFilePart[] {
  return attachments.map((a) => ({
    type: "file" as const,
    url: a.url,
    mediaType: a.mediaType,
    ...(a.name ? { filename: a.name } : {}),
  }));
}
