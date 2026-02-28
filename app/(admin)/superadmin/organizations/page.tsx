"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, Pencil, Check, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";

type OrgWithCounts = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: string;
  maxMembers: number | null;
  memberCount: number;
};

function MemberLimitEditor({ org }: { org: OrgWithCounts }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    org.maxMembers !== null ? String(org.maxMembers) : "",
  );

  const mutation = useMutation({
    mutationFn: async (maxMembers: number | null) => {
      const res = await fetch(`/api/superadmin/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxMembers }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Member limit updated");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setEditing(false);
    },
    onError: () => {
      toast.error("Failed to update member limit");
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
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.preventDefault()}
      >
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
      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
      onClick={(e) => {
        e.preventDefault();
        setEditing(true);
      }}
    >
      {org.maxMembers !== null
        ? `${org.memberCount} / ${org.maxMembers} members`
        : `${org.memberCount} members (unlimited)`}
      <Pencil className="size-3" />
    </button>
  );
}

export default function Page() {
  const { data: organizations, isLoading } = useQuery<OrgWithCounts[]>({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return res.json();
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage all platform organizations
          </p>
        </div>
        <Link href="/admin/create-org">
          <Button className="gap-2">
            <Plus className="size-4" />
            Create Organization
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-[12px]" />
          ))
        ) : organizations && organizations.length > 0 ? (
          organizations.map((org) => (
            <Link
              key={org.id}
              href={`/admin/org/${org.slug}`}
              className="bg-white rounded-[12px] border border-zinc-200 py-4 px-5 flex items-center justify-between hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                {org.logo && (
                  <Image
                    src={org.logo}
                    alt={org.name}
                    width={36}
                    height={36}
                    className="rounded-md object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-sm">{org.name}</p>
                  <p className="text-xs text-zinc-400">{org.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <MemberLimitEditor org={org} />
                <p className="text-xs text-zinc-400">
                  Created {new Date(org.createdAt).toLocaleDateString()}
                </p>
                <ArrowRight className="size-4 text-zinc-400" />
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-zinc-400 mb-4">No organizations yet.</p>
            <Link href="/admin/create-org">
              <Button variant="outline" className="gap-2">
                <Plus className="size-4" />
                Create your first organization
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
