"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ban, CheckCircle, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BoringAvatar from "boring-avatars";

type UserOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type PlatformUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  createdAt: string;
  organizations: UserOrg[];
};

function roleBadge(role: string | null) {
  if (role === "superadmin")
    return <Badge className="bg-zinc-900 text-white text-xs">Superadmin</Badge>;
  if (role === "admin")
    return <Badge className="bg-zinc-700 text-white text-xs">Admin</Badge>;
  return (
    <Badge variant="secondary" className="text-xs">
      User
    </Badge>
  );
}

export default function Page() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useQuery<PlatformUser[]>({
    queryKey: ["superadmin-users"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({
      userId,
      action,
    }: {
      userId: string;
      action: "ban" | "unban";
    }) => {
      const res = await fetch("/api/superadmin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} user`);
      return res.json();
    },
    onSuccess: (_, { action }) => {
      toast.success(action === "ban" ? "User banned" : "User unbanned");
      queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
    onError: (_, { action }) => {
      toast.error(`Failed to ${action} user`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/superadmin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("User deleted");
      queryClient.invalidateQueries({ queryKey: ["superadmin-users"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete user",
      );
    },
  });

  const filtered = users?.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage all platform users
          </p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-[12px]" />
          ))
        ) : filtered && filtered.length > 0 ? (
          filtered.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-[12px] border border-zinc-200 py-4 px-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage src={user.image || ""} alt={user.name} />
                  <AvatarFallback className="rounded-full p-0 bg-transparent">
                    <BoringAvatar
                      size={36}
                      name={user.id || user.email || user.name || "user"}
                      variant="pixel"
                      square={false}
                    />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{user.name}</p>
                    {roleBadge(user.role)}
                    {user.banned && (
                      <Badge variant="destructive" className="text-xs">
                        Banned
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {user.organizations.length > 0 && (
                  <div className="flex items-center gap-1">
                    {user.organizations.slice(0, 3).map((org) => (
                      <Badge
                        key={org.id}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {org.name}
                      </Badge>
                    ))}
                    {user.organizations.length > 3 && (
                      <span className="text-xs text-zinc-400">
                        +{user.organizations.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-zinc-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
                {user.role !== "superadmin" && (
                  <>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        {user.banned ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Ban className="size-4" />
                          </Button>
                        )}
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {user.banned ? "Unban User" : "Ban User"}
                          </AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogDescription>
                          {user.banned ? (
                            <>
                              Are you sure you want to unban{" "}
                              <strong>{user.name}</strong>? They will regain
                              access to the platform.
                            </>
                          ) : (
                            <>
                              Are you sure you want to ban{" "}
                              <strong>{user.name}</strong>? They will lose
                              access to the platform.
                            </>
                          )}
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <Button
                            variant={user.banned ? "default" : "destructive"}
                            onClick={() =>
                              banMutation.mutate({
                                userId: user.id,
                                action: user.banned ? "unban" : "ban",
                              })
                            }
                            disabled={banMutation.isPending}
                          >
                            {user.banned ? "Unban" : "Ban"}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User</AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogDescription>
                          Are you sure you want to permanently delete{" "}
                          <strong>{user.name}</strong>? This will remove their
                          account, memberships, conversations, and all
                          associated data. This action cannot be undone.
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <Button
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(user.id)}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-400 text-center py-12">
            {search ? "No users match your search." : "No users found."}
          </p>
        )}
      </div>
    </div>
  );
}
