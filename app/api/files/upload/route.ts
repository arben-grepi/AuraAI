import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isSystemAdmin, isSuperAdmin } from "@/lib/auth-utils";
import { withMetrics } from "@/lib/with-metrics";

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
      message: "File type should be JPEG or PNG",
    }),
});

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function handlePost(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const devSelfOrgCreation =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_ALLOW_SELF_ORG_CREATION === "1";

  const canUpload =
    isSuperAdmin(session.user.role) ||
    isSystemAdmin(session.user.role) ||
    devSelfOrgCreation;

  console.log("[upload] Auth check:", {
    role: session.user.role,
    devSelfOrgCreation,
    canUpload,
  });

  if (!canUpload) {
    console.warn("[upload] Rejected: user lacks upload permission");
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (request.body === null) {
    return NextResponse.json({ error: "Empty request body" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });
    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.issues
        .map((issue) => issue.message)
        .join(", ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const originalFilename = (formData.get("file") as File).name;
    const sanitizedFilename =
      originalFilename
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/\.\./g, "")
        .replace(/^\/+|\/+$/g, "")
        .substring(0, 255) || "file";

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${sanitizedFilename}`;
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;

    console.log("[upload] Uploading to S3:", { bucket, region, key, size: fileBuffer.length, type: file.type });

    if (!bucket || !region) {
      console.error("[upload] Missing AWS_S3_BUCKET_NAME or AWS_REGION in env");
      return NextResponse.json({ error: "Server misconfiguration: S3 bucket/region not set" }, { status: 500 });
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: file.type,
      }),
    );

    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    console.log("[upload] Success:", fileUrl);

    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error) {
    console.error("[upload] S3 error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export const POST = withMetrics(handlePost);
