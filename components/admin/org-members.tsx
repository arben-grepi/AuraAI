"use client";

import { useQuery } from "@tanstack/react-query";
import { OrganizationMember } from "@/lib/types";
import AddMember from "./add-member";

export default function OrgMember({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["org-members", id],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/organizations/members?org=${id}`,
      );
      return response.json();
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (data.error) {
    return <div>{data.error}</div>;
  }

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
