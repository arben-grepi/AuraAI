"use client";

import { Organization, OrganizationMember } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader, Trash2 } from "lucide-react";
import { deleteOrg } from "@/lib/actions";
import { toast } from "sonner";
import { useState } from "react";

export default function OrgItem({
  organization,
}: {
  organization: Organization;
}) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleDelete = async () => {
    setIsDeleting(true);
    const { success, data, error } = await deleteOrg(organization.id);
    if (success) {
      toast.success(data?.data || "Organization deleted");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    } else {
      toast.error(error || "Failed to delete organization");
    }
    setIsDeleting(false);
  };

  return (
    <div className="bg-white group relative rounded-[12px] border border-zinc-100 py-4.5 px-5 flex justify-between items-center w-full max-w-[600px]">
      <div
        onClick={handleDelete}
        className="group-hover:opacity-100 opacity-0 transition-all duration-200 absolute cursor-pointer p-2 top-[-5px] left-[-16px] w-8 h-8 bg-red-500/10 flex items-center justify-center rounded-full"
      >
        {isDeleting ? (
          <Loader className="size-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4 text-red-500" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Image
            src={organization.logo}
            alt={organization.name}
            width={28}
            height={28}
            className="rounded-sm object-cover"
          />
          <p className="font-medium text-base text-black">
            {organization.name}
          </p>
        </div>
        <p className="text-base font-medium text-zinc-500">
          {data?.members.length} active users
        </p>
      </div>
      <Link
        className="flex items-center gap-2 text-cyan-600"
        href={`/admin/org/${organization.slug}`}
      >
        Go to organization <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
