"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OrganizationMember } from "@/lib/types";
import AddMember from "./add-member";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { removeMemberFromOrg } from "@/lib/actions";

export default function OrgMember({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["org-members", id],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/organizations/members?org=${id}`,
      );
      return response.json();
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (data.error) {
    return <div>{data.error}</div>;
  }

  const handleRemoveMember = async (member: OrganizationMember) => {
    const response = await removeMemberFromOrg({
      idOrEmail: member.user.email,
      organizationId: id,
    });
    if (response.success) {
      toast.success("Member removed from organization");
      queryClient.invalidateQueries({ queryKey: ["org-members", id] });
    } else {
      const errorMessage = response.error || "Unknown error occurred";
      toast.error(errorMessage);
    }
  };

  return (
    <div>
      <div className="space-y-4">
        <div>
          <p className="">Members:</p>
        </div>
        <div className="flex flex-col gap-2">
          {data.members.map((member: OrganizationMember) => (
            <div
              className="font-bold flex items-center gap-2 justify-between"
              key={member.id}
            >
              <p>{member.user.name}</p>
              <p>{member.role}</p>
              <Button onClick={() => handleRemoveMember(member)}>Remove</Button>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <AddMember id={id} />
      </div>
    </div>
  );
}
