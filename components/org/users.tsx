"use client";

import { Button } from "../ui/button";
import { Organization, OrganizationMember } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../ui/dialog";
import { useState } from "react";
import { Input } from "../ui/input";
import { useForm } from "react-hook-form";
import { signUpSchema } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "../ui/form";
import { createOrgUser, deleteOrgUser, updateMemberRole } from "@/lib/actions";
import { toast } from "sonner";
import { Loader, Trash2, Mail, UserPlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Role, RoleCombobox } from "./combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

export default function Users({
  org,
  userId,
}: {
  org: Organization;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [addMode, setAddMode] = useState<"create" | "invite">("create");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const queryClient = useQueryClient();

  const addMemberForm = useForm<z.infer<typeof signUpSchema>>({
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (values: z.infer<typeof signUpSchema>) => {
    setIsLoadingForm(true);
    const { data, error, success } = await createOrgUser({
      slug: org.slug,
      values: values,
    });
    if (success) {
      toast.success(data?.data || "User created");
      addMemberForm.reset();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["org-users", org.slug] });
    } else {
      toast.error(error || "Failed to create user");
    }
    setIsLoadingForm(false);
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    setIsLoadingForm(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          organizationSlug: org.slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send invitation");
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        setInviteRole("member");
        setOpen(false);
      }
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setIsLoadingForm(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["org-users", org.slug],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/organizations/members?org=${org.id}`,
      );
      return response.json();
    },
    enabled: !!org.slug,
  });

  const currentUserId = userId;

  const filteredMembers = data?.members?.filter(
    (member: OrganizationMember) => member.user.id !== currentUserId,
  );

  return (
    <div>
      <div className="w-full flex justify-between px-8 py-10 border-b border-zinc-200">
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-xl">Members</h1>
          <p className="text-base text-zinc-600">
            Manage members in {org.name}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-10 px-8 py-10">
        <div className="flex justify-between items-center max-w-[560px]">
          <div className="space-y-2">
            <p className="font-medium text-sm">{org.name} Members</p>
            <p className="text-sm text-zinc-600">
              Manage members and invitations
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant={"outline"}
                className="w-fit py-5 cursor-pointer"
              >
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[470px] sm:max-w-[470px]">
              <DialogHeader>
                <DialogTitle className="text-sm">Add Member</DialogTitle>
                <DialogDescription>
                  Create a new user or invite by email
                </DialogDescription>
              </DialogHeader>

              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setAddMode("create")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    addMode === "create"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  <UserPlus className="size-3.5" />
                  Create user
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("invite")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    addMode === "invite"
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  <Mail className="size-3.5" />
                  Invite user
                </button>
              </div>

              {addMode === "create" && (
                <div className="space-y-4">
                  <Form {...addMemberForm}>
                    <form
                      onSubmit={addMemberForm.handleSubmit(onSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={addMemberForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input className="form-input" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addMemberForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input className="form-input" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addMemberForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input className="form-input" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addMemberForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                className="form-input"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="py-5 cursor-pointer w-full"
                      >
                        {isLoadingForm ? (
                          <Loader className="size-4 animate-spin" />
                        ) : (
                          "Create & Add Member"
                        )}
                      </Button>
                    </form>
                  </Form>
                </div>
              )}

              {addMode === "invite" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      className="form-input"
                      placeholder="Enter email address"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="form-input w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleInviteUser}
                    disabled={!inviteEmail || isLoadingForm}
                    className="py-5 cursor-pointer w-full"
                  >
                    {isLoadingForm ? (
                      <Loader className="size-4 animate-spin" />
                    ) : (
                      "Send Invitation"
                    )}
                  </Button>
                </div>
              )}

              <Button
                onClick={() => setOpen(false)}
                className="py-5 cursor-pointer w-full"
                variant="outline"
              >
                Cancel
              </Button>
            </DialogContent>
          </Dialog>
        </div>
        <div className="max-w-[560px] bg-white rounded-[12px] border border-zinc-200">
          {isLoading && (
            <div className="w-50 h-4 bg-zinc-100 my-4 rounded-[4px] animate-pulse"></div>
          )}
          {data && (
            <div className="py-3 px-3 border-b border-zinc-100 text-sm font-medium">
              Team Members{" "}
              <span className="bg-zinc-100 rounded-full p-1.5 text-xs text-zinc-500">
                {filteredMembers?.length || 0}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <UserItemSkeleton key={index} />
                ))
              : data &&
                filteredMembers?.map((member: OrganizationMember) => (
                  <UserItem
                    key={member.id}
                    member={member}
                    orgSlug={org.slug}
                  />
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const UserItemSkeleton = () => {
  return (
    <div className="w-full h-3 bg-zinc-100 rounded-[4px] animate-pulse"></div>
  );
};

const UserItem = ({
  member,
  orgSlug,
}: {
  member: OrganizationMember;
  orgSlug: string;
}) => {
  const [role, setRole] = useState(member.role);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleRoleChange = async (value: Role) => {
    if (value === member.role) {
      return;
    }

    setIsUpdating(true);
    const { success, error } = await updateMemberRole({
      memberId: member.id,
      organizationId: member.organizationId,
      role: value,
    });

    if (success) {
      setRole(value);
      toast.success("Member role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["org-users", orgSlug] });
    } else {
      toast.error(error || "Failed to update member role");
      setRole(member.role);
    }
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const { success, error } = await deleteOrgUser({
      userId: member.user.id,
      organizationId: member.organizationId,
    });

    if (success) {
      toast.success("User deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["org-users", orgSlug] });
    } else {
      toast.error(error || "Failed to delete user");
    }
    setIsDeleting(false);
  };

  return (
    <div className="flex items-center gap-2 justify-between px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{member.user.name}</p>
        <p className="text-sm text-zinc-500">{member.user.email}</p>
      </div>
      <div className="flex items-center gap-2">
        <RoleCombobox
          onValueChange={handleRoleChange}
          value={role}
          disabled={isUpdating}
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-400 hover:text-red-600 cursor-pointer"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {member.user.name}? This will
                permanently remove the user and their membership. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
