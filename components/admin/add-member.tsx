"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { OrganizationMember } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function AddMember({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["org-members", id],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/organizations/members?org=${id}`,
      );
      return response.json();
    },
  });
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Add a new member to the organization
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div>
            <p>Loading...</p>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            {data?.members && data?.members.length > 0 ? (
              <div>
                <p>No Users Found</p>
              </div>
            ) : (
              data?.members
                ?.filter(
                  (member: OrganizationMember) =>
                    member.user.id !== data.user.id,
                )
                .map((member: OrganizationMember) => (
                  <div
                    className="p-2 border border-gray-200 rounded-md flex items-center justify-between"
                    key={member.id}
                  >
                    <p>{member.user.name}</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button>Add</Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <p>As what role?</p>
                      </PopoverContent>
                    </Popover>
                  </div>
                ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
