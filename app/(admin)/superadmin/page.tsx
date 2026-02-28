"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Organization } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/superadmin/tables/data-table";
import { columns } from "@/components/superadmin/tables/columns";

type Stats = {
  organizations: number;
  users: number;
  admins: number;
  conversations: number;
  messages: number;
};

export default function Page() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["superadmin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/superadmin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: organizations, isLoading: orgsLoading } = useQuery<
    Organization[]
  >({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) throw new Error("Failed to fetch organizations");
      return res.json();
    },
  });

  const statCards = [
    {
      title: "Organizations",
      value: stats?.organizations ?? 0,
    },
    {
      title: "Users",
      value: stats?.users ?? 0,
    },
    {
      title: "Admins",
      value: stats?.admins ?? 0,
    },
    {
      title: "Conversations",
      value: stats?.conversations ?? 0,
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Platform overview and statistics
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={`rounded-[12px] border-0 shadow-sm hover:shadow-mdtransition-all duration-200 cursor-pointer`}
          >
            <CardHeader className="pb-1">
              <CardTitle className="text-lg font-medium text-black-300">
                {stat.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-10 w-20 bg-white/10" />
              ) : (
                <p className="text-4xl font-bold text-black">{stat.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Organizations</h2>
        <Link
          href="/superadmin/organizations"
          className="text-sm underline text-zinc-500 hover:text-zinc-800 flex items-center gap-1 transition-colors"
        >
          View all
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {orgsLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[12px]" />
          ))
        ) : organizations && organizations.length > 0 ? (
          organizations.map((org) => (
            <DataTable
              columns={columns}
              data={organizations}
              key={org.id}
            ></DataTable>
          ))
        ) : (
          <p className="text-sm text-zinc-400">No organizations yet.</p>
        )}
      </div>
    </div>
  );
}
