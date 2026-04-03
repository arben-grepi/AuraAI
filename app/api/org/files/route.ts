import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/auth-utils";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    const page = Math.max(Number(searchParams.get("page") ?? "1"), 1);
    const limit = Math.max(Number(searchParams.get("limit") ?? "10"), 1);
    const search = (searchParams.get("search") ?? "").trim();
    const offset = (page - 1) * limit;

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    if (!isSystemAdmin(session.user.role)) {
      const membership = await prisma.member.findFirst({
        where: {
          organizationId: orgId,
          userId: session.user.id,
        },
        select: { id: true },
      });

      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const rootFilesWhere = {
      organizationId: orgId,
      fileFolderId: null,
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const foldersWhere = {
      organizationId: orgId,
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                resources: {
                  some: {
                    name: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [rootFilesCount, foldersCount, folderOptions] = await Promise.all([
      prisma.resource.count({
        where: rootFilesWhere,
      }),
      prisma.fileFolder.count({
        where: foldersWhere,
      }),
      prisma.fileFolder.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const totalItems = rootFilesCount + foldersCount;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safeOffset = Math.min(offset, Math.max(totalItems - 1, 0));

    const rootFileSkip = safeOffset;
    const rootFileTake = Math.max(
      Math.min(limit, rootFilesCount - rootFileSkip),
      0,
    );

    const folderSkip = Math.max(safeOffset - rootFilesCount, 0);
    const folderTake = Math.max(limit - rootFileTake, 0);

    const [rootFiles, folders] = await Promise.all([
      rootFileTake > 0
        ?         prisma.resource.findMany({
            where: rootFilesWhere,
            select: { id: true, name: true, tags: true },
            orderBy: { name: "asc" },
            skip: rootFileSkip,
            take: rootFileTake,
          })
        : Promise.resolve([]),
      folderTake > 0
        ? prisma.fileFolder.findMany({
            where: foldersWhere,
            select: {
              id: true,
              name: true,
              resources: {
                where: search
                  ? {
                      name: {
                        contains: search,
                        mode: "insensitive",
                      },
                    }
                  : undefined,
                select: { id: true, name: true, tags: true },
                orderBy: { name: "asc" },
              },
            },
            orderBy: { name: "asc" },
            skip: folderSkip,
            take: folderTake,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      folders,
      rootFiles,
      folderOptions,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
      search,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }

}
