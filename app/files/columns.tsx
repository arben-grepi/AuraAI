"use client";

import { ColumnDef } from "@tanstack/react-table";
import { S3ObjectsAPIResponse } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import Link from "next/link";

export const columns: ColumnDef<S3ObjectsAPIResponse["items"][number]>[] = [
  {
    accessorKey: "key",
    header: "Key",
  },
  {
    accessorKey: "size",
    header: "Size",
    cell: ({ row }) => {
      const size = row.original.size;
      return <div>{formatBytes(size)}</div>;
    },
  },
  {
    accessorKey: "lastModified",
    header: "Last Modified",
    cell: ({ row }) => {
      const lastModified = row.original.lastModified;
      if (!lastModified) {
        return <div>N/A</div>;
      }
      return <div>{new Date(lastModified).toLocaleString()}</div>;
    },
  },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      return (
        <Link
          className="underline"
          href={row.original.url}
          target="_blank"
          prefetch={false}
        >
          {row.original.key}
        </Link>
      );
    },
  },
];
