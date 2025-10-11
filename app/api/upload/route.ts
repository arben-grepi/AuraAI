import { S3Client } from "@aws-sdk/client-s3";
import {
  createUploadRouteHandler,
  route,
  type Router,
} from "better-upload/server";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const router: Router = {
  client: s3,
  bucketName: process.env.AWS_S3_BUCKET || "kommun-ai",
  routes: {
    upload: route({
      fileTypes: ["image/*"],
    }),
  },
};

export const { POST } = createUploadRouteHandler(router);
