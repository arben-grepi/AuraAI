import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  const org = await prisma.organization.findUnique({
    where: {
      slug: slug!,
    },
  });

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  // Parse metadata if it's a string
  const parsedMetadata = org.metadata
    ? typeof org.metadata === "string"
      ? JSON.parse(org.metadata)
      : org.metadata
    : null;

  return NextResponse.json({
    ...org,
    metadata: parsedMetadata,
  });
}
