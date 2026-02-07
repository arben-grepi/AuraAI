import type { ChatFilePart, UploadedAttachment } from "../types";

/**
 * Maps uploaded attachments to the file part shape expected by the chat API.
 */
export function attachmentsToChatFileParts(
  attachments: UploadedAttachment[],
): ChatFilePart[] {
  return attachments.map((attachment) => {
    const kommunMetadata: Record<string, string | number | null> = {
      storageProvider: "s3",
      size: attachment.size,
    };

    if (attachment.objectKey) {
      kommunMetadata.objectKey = attachment.objectKey;
    }

    if (attachment.organizationId !== undefined) {
      kommunMetadata.organizationId = attachment.organizationId ?? null;
    }

    return {
      type: "file",
      mediaType: attachment.mediaType || "application/octet-stream",
      filename: attachment.name,
      url: attachment.url,
      providerMetadata: { kommun: kommunMetadata },
    } satisfies ChatFilePart;
  });
}
