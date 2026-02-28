"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Organization } from "@/lib/types";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const columns: ColumnDef<Organization>[] = [
  {
    accessorKey: "logo",
    header: "Logo",
    cell: ({ row }) => {
      return (
        <Image
          src={row.original.logo}
          alt={row.original.name}
          width={32}
          height={32}
        />
      );
    },
  },
  {
    accessorKey: "name",
    header: "Name",
  },

  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => {
      return (
        <p className="text-sm text-zinc-500">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </p>
      );
    },
  },
  {
    accessorKey: "actions",
    header: "Actions",
    cell: ({ row }) => {
      return (
        <Button variant="link" size="sm">
          <Link href={`/admin/org/${row.original.slug}`}>View</Link>
        </Button>
      );
    },
  },
];
