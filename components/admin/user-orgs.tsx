"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "../ui/card";
import { Organization } from "@/lib/types";
import Image from "next/image";

export default function UserOrgs() {
  const { data, isLoading } = useQuery({
    queryKey: ["user-orgs"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/organizations`);
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
  return (
    <Card>
      <CardContent>
        <h1>My Organizations</h1>
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <div>
            {data.map((org: Organization) => (
              <div className="flex items-center gap-2" key={org.id}>
                <Image src={org.logo} alt={org.name} width={48} height={48} />
                <div>
                  <h2>{org.name}</h2>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
