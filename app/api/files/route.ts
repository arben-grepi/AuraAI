import { NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const runtime = "nodejs";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(req: Request) {
  // const session = await auth.api.getSession({
  //   headers: await headers(),
  // });

  // if (!session) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }
  const bucketName = process.env.AWS_S3_BUCKET_NAME!;
  if (!bucketName) {
    return NextResponse.json(
      { error: "AWS_S3_BUCKET_NAME is not set" },
      { status: 500 },
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const prefix = searchParams.get("prefix") ?? undefined;
    const continuationToken = searchParams.get("cursor") ?? undefined;

    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 50,
      }),
    );

    const items = (list.Contents ?? [])
      .filter((obj) => !!obj.Key)
      .map((obj) => ({
        key: obj.Key!,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified?.toISOString() ?? null,
      }));

    const signed = await Promise.all(
      items.map(async (it) => {
        const cmd = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: it.key,
        });
        const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
        return { ...it, url };
      }),
    );

    return NextResponse.json({
      items: signed,
      nextCursor: list.IsTruncated
        ? (list.NextContinuationToken ?? null)
        : null,
      prefix: prefix ?? null,
    });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 },
    );
  }
}
