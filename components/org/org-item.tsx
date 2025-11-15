"use client";

import { Organization, OrganizationMember } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function OrgItem({
  organization,
}: {
  organization: Organization;
}) {
  const { data } = useQuery({
    queryKey: ["org-users", organization.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/organizations/members?org=${organization.id}`,
      );
      return response.json() as Promise<{ members: OrganizationMember[] }>;
    },
    enabled: !!organization.id,
  });
  return (
    <div className="bg-white rounded-[12px] border border-zinc-100 py-4.5 px-5 flex justify-between items-center w-full max-w-[600px]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Image
            src={organization.logo}
            alt={organization.name}
            width={28}
            height={28}
            className="rounded-sm object-cover w-[28px] h-[28px] aspect-square"
          />
          <p className="font-medium text-base text-black">
            {organization.name}
          </p>
        </div>
        <p className="text-base font-medium text-zinc-500">
          {data?.members.length} Active users
        </p>
      </div>
      <Link
        className="flex items-center gap-2 text-cyan-600"
        href={`/admin/org/${organization.slug}`}
      >
        Open organization <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
