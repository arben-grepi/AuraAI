import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeSlugParam } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slugRaw = searchParams.get("slug");

  if (!slugRaw) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  const slug = normalizeSlugParam(slugRaw);
  const org = await prisma.organization.findUnique({
    where: {
      slug,
    },
  });

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  let parsedMetadata: unknown = null;
  if (org.metadata) {
    if (typeof org.metadata === "string") {
      try {
        parsedMetadata = JSON.parse(org.metadata);
      } catch {
        parsedMetadata = null;
      }
    } else {
      parsedMetadata = org.metadata;
    }
  }

  return NextResponse.json({
    ...org,
    metadata: parsedMetadata,
  });
}
