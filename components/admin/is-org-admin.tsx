"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "../ui/badge";
import { Loader2 } from "lucide-react";

export default function IsOrgAdmin({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["is-org-admin", id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/organizations/members`, {
        method: "POST",
        body: JSON.stringify({ organizationId: id }),
      });
      return response.json();
    },
  });
  return (
    <div>
      {isLoading ? (
        <Badge className="bg-sidebar-accent text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
        </Badge>
      ) : (
        <div>
          {data?.data ? (
            <Badge className="bg-sidebar-accent text-green-600">Admin</Badge>
          ) : (
            <Badge className="bg-sidebar-accent text-red-600">Not Admin</Badge>
          )}
        </div>
      )}
    </div>
  );
}
