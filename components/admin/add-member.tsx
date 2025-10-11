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
import { UsersWithRole, UsersWithRoleResponse } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQueryClient } from "@tanstack/react-query";
import { addMemberToOrg } from "@/lib/actions";
import { toast } from "sonner";

export default function AddMember({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery<UsersWithRoleResponse>({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users`);
      return response.json();
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const handleAddMember = async (
    userId: string,
    role: "owner" | "admin" | "member",
  ) => {
    const response = await addMemberToOrg(id, userId, role);
    if (response.success) {
      toast.success("Member added to organization");
      queryClient.invalidateQueries({ queryKey: ["org-members", id] });
    } else {
      toast.error(response.error);
    }
  };

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

        {data?.users && data?.users.length > 0 ? (
          data?.users.map((user: UsersWithRole) => (
            <div
              className="flex items-center gap-2 justify-between"
              key={user.id}
            >
              <p>{user.name}</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button>Add</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <p>As what role?</p>
                  <div className="flex flex-col gap-2">
                    <div
                      className="cursor-pointer p-2 rounded-md bg-gray-100 hover:bg-gray-200"
                      onClick={() => handleAddMember(user.id, "owner")}
                    >
                      Owner
                    </div>
                    <div
                      className="cursor-pointer p-2 rounded-md bg-gray-100 hover:bg-gray-200"
                      onClick={() => handleAddMember(user.id, "admin")}
                    >
                      Admin
                    </div>
                    <div
                      className="cursor-pointer p-2 rounded-md bg-gray-100 hover:bg-gray-200"
                      onClick={() => handleAddMember(user.id, "member")}
                    >
                      Member
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ))
        ) : (
          <div>
            <p>No users found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
