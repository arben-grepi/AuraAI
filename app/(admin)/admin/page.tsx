"use client";

import CreateOrg from "@/components/admin/create-org";
import IsOrgAdmin from "@/components/admin/is-org-admin";
import { deleteOrg } from "@/lib/actions";
import { Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Building2, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import OrgMember from "@/components/admin/org-members";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Page() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/organizations`);
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold text-foreground text-balance">
                Organizations
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage your organizations and their settings
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
  };

  const handleDelete = async (id: string) => {
    const { success, data, error } = await deleteOrg(id);
    if (success) {
      toast.success(data?.data || "Organization deleted");
      handleSuccess();
    } else {
      toast.error(error || "Failed to delete organization");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-foreground text-balance">
              Organizations
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your organizations and their settings
            </p>
          </div>
          <CreateOrg onSuccess={handleSuccess} />
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {data?.length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total Organizations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-chart-2/20 rounded-lg">
                  <Users className="w-5 h-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {data?.filter((org: Organization) => org.id).length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Active Organizations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <CreateOrg onSuccess={handleSuccess} />
                <div>
                  <p className="text-2xl font-semibold text-foreground">New</p>
                  <p className="text-sm text-muted-foreground">
                    Create Organization
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations Grid */}
        {data && data.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((organization: Organization) => (
              <Card
                key={organization.id}
                className="group hover:shadow-lg transition-all duration-200 border-border"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="relative">
                        <Image
                          src={organization.logo || "/placeholder.svg"}
                          alt={organization.name}
                          width={48}
                          height={48}
                          className="rounded-lg border border-border"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={`/admin/org/${organization.slug}`}
                          className="font-semibold text-foreground text-lg truncate"
                        >
                          {organization.name}
                        </a>
                        <p className="text-sm text-muted-foreground truncate">
                          {organization.slug}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDelete(organization.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="py-4">
                    <OrgMember id={organization.id} />
                  </div>
                  <div className="flex items-center justify-between">
                    <IsOrgAdmin id={organization.id} />
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
                      <span className="text-xs text-muted-foreground">
                        Active
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-muted rounded-full">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No organizations found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by creating your first organization
                  </p>
                  <CreateOrg onSuccess={handleSuccess} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
