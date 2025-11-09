import { S3Client } from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;

function assert(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getS3Client(): S3Client {
  if (!cachedClient) {
    const region = assert(process.env.AWS_REGION, "AWS_REGION");
    const accessKeyId = assert(
      process.env.AWS_ACCESS_KEY_ID,
      "AWS_ACCESS_KEY_ID",
    );
    const secretAccessKey = assert(
      process.env.AWS_SECRET_ACCESS_KEY,
      "AWS_SECRET_ACCESS_KEY",
    );

    cachedClient = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return cachedClient;
}

export function getS3BucketName(): string {
  return assert(process.env.AWS_S3_BUCKET_NAME, "AWS_S3_BUCKET_NAME");
}
