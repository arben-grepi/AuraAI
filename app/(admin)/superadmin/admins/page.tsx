"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldOff, Pencil, Check, X, Plus, Mail, Loader } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema } from "@/lib/schema";
import { z } from "zod";
import { useState } from "react";

type Admin = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  role: string;
  maxOrgs: number | null;
  ownedOrgCount: number;
};

function OrgLimitEditor({ admin }: { admin: Admin }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    admin.maxOrgs !== null ? String(admin.maxOrgs) : "",
  );

  const mutation = useMutation({
    mutationFn: async (maxOrgs: number | null) => {
      const res = await fetch("/api/superadmin/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: admin.id, maxOrgs }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Org limit updated");
      queryClient.invalidateQueries({ queryKey: ["superadmin-admins"] });
      setEditing(false);
    },
    onError: () => {
      toast.error("Failed to update org limit");
    },
  });

  const handleSave = () => {
    const parsed = value.trim() === "" ? null : parseInt(value, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 1)) {
      toast.error("Enter a positive number or leave empty for unlimited");
      return;
    }
    mutation.mutate(parsed);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Unlimited"
          className="w-24 h-7 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleSave}
          disabled={mutation.isPending}
        >
          <Check className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setEditing(false)}
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <button
      className="flex items-center gap-1.5"
      onClick={() => setEditing(true)}
    >
      <Badge variant="secondary" className="text-xs font-normal">
        {admin.maxOrgs !== null
          ? `${admin.ownedOrgCount} / ${admin.maxOrgs} orgs`
          : `${admin.ownedOrgCount} orgs (unlimited)`}
      </Badge>
      <Pencil className="size-3 text-zinc-400" />
    </button>
  );
}

export default function Page() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const createForm = useForm<z.infer<typeof signUpSchema>>({
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
    resolver: zodResolver(signUpSchema),
  });

  const { data: admins, isLoading } = useQuery<Admin[]>({
    queryKey: ["superadmin-admins"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/admins");
      if (!res.ok) throw new Error("Failed to fetch admins");
      return res.json();
    },
  });

  const demoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/superadmin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to demote admin");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Admin demoted successfully");
      queryClient.invalidateQueries({ queryKey: ["superadmin-admins"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
    onError: () => {
      toast.error("Failed to demote admin");
    },
  });

  const onCreateSubmit = async (values: z.infer<typeof signUpSchema>) => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/superadmin/admins/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create admin");
      toast.success("Admin created successfully");
      createForm.reset();
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["superadmin-admins"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-stats"] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create admin",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admins</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage platform administrators
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" disabled>
            <Mail className="size-4" />
            Invite Admin
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Create Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[470px]">
              <DialogHeader>
                <DialogTitle>Create Admin</DialogTitle>
                <DialogDescription>
                  Create a new admin account with full platform management
                  access.
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form
                  onSubmit={createForm.handleSubmit(onCreateSubmit)}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={createForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Min. 8 characters"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating && (
                        <Loader className="size-4 mr-2 animate-spin" />
                      )}
                      Create Admin
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-[12px]" />
          ))
        ) : admins && admins.length > 0 ? (
          admins.map((admin) => (
            <div
              key={admin.id}
              className="bg-white rounded-[12px] border border-zinc-200 py-4 px-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-medium text-zinc-600">
                  {admin.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{admin.name}</p>
                    <OrgLimitEditor admin={admin} />
                  </div>
                  <p className="text-xs text-zinc-400">{admin.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-xs text-zinc-400">
                  Since {new Date(admin.createdAt).toLocaleDateString()}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <ShieldOff className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Demote Admin</AlertDialogTitle>
                    </AlertDialogHeader>
                    <AlertDialogDescription>
                      Are you sure you want to remove admin privileges from{" "}
                      <strong>{admin.name}</strong>? They will be demoted to a
                      regular user.
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <Button
                        variant="destructive"
                        onClick={() => demoteMutation.mutate(admin.id)}
                        disabled={demoteMutation.isPending}
                      >
                        Demote
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-400 text-center py-12">
            No admin users found.
          </p>
        )}
      </div>
    </div>
  );
}
