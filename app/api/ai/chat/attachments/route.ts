import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

import { auth } from "@/lib/auth";
import { getS3BucketName, getS3Client } from "@/lib/s3";
import prisma from "@/lib/prisma";
import { isSystemAdmin } from "@/lib/auth-utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const fileSchema = z.object({
  file: z.instanceof(Blob, { message: "No file provided" }),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!req.body) {
    return NextResponse.json({ error: "Empty request body" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    const validated = fileSchema.safeParse({ file });
    if (!validated.success) {
      const message = validated.error.issues
        .map((issue) => issue.message)
        .join(", ");
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const uploadFile = validated.data.file as File;
    const fileType = (uploadFile.type || "").toLowerCase();
    const fileName = uploadFile.name.toLowerCase();

    if (uploadFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size should be 5MB or less" },
        { status: 413 },
      );
    }

    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    const isAllowedType =
      (fileType && allowedTypes.includes(fileType)) ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".pdf");

    if (!isAllowedType) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 415 },
      );
    }

    const arrayBuffer = await uploadFile.arrayBuffer();
    const client = getS3Client();
    const bucket = getS3BucketName();

    const requestedOrgId = formData.get("orgId")?.toString();
    const activeOrgId = session.session?.activeOrganizationId ?? undefined;
    const targetOrgId = requestedOrgId ?? activeOrgId;

    if (!targetOrgId) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 },
      );
    }

    if (!isSystemAdmin(session.user.role)) {
      const membership = await prisma.member.findFirst({
        where: {
          organizationId: targetOrgId,
          userId: session.user.id,
        },
        select: { id: true },
      });

      if (!membership) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFileName = uploadFile.name
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/\.\./g, "")
      .replace(/^\/+|\/+$/g, "")
      .substring(0, 255); // Limit length

    const key = [
      "chat-uploads",
      targetOrgId,
      crypto.randomUUID(),
      sanitizedFileName || "file",
    ].join("/");

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(arrayBuffer),
        ContentType: fileType || "application/octet-stream",
      }),
    );

    const region = process.env.AWS_REGION ?? "us-east-1";
    const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      url,
      objectKey: key,
      mediaType: fileType || "application/octet-stream",
      size: uploadFile.size,
      organizationId: targetOrgId,
    });
  } catch (error) {
    console.error("Attachment upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
