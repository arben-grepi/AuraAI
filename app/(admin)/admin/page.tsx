"use client";

import { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import OrgItem from "@/components/org/org-item";
import Link from "next/link";

export default function Page() {
  const { data: organizations, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/organizations`);
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return <div className="min-h-screen bg-background"></div>;
  }

  // const handleSuccess = () => {
  //   queryClient.invalidateQueries({ queryKey: ["organizations"] });
  // };

  // const handleDelete = async (id: string) => {
  //   const { success, data, error } = await deleteOrg(id);
  //   if (success) {
  //     toast.success(data?.data || "Organization deleted");
  //     handleSuccess();
  //   } else {
  //     toast.error(error || "Failed to delete organization");
  //   }
  // };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="flex flex-col gap-2 text-center mb-14">
        <h1 className="text-2xl font-bold">Please select your organization</h1>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-[600px]">
        {organizations.map((organization: Organization) => {
          return <OrgItem key={organization.id} organization={organization} />;
        })}
      </div>
      <Link className="block w-full max-w-[600px]" href="/admin/create-org">
        <Button
          className="bg-white w-full max-w-[600px] mt-4 py-6 cursor-pointer"
          variant="outline"
        >
          Create new organization <Plus className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}
