"use client";

import { Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Organization } from "@/lib/types";
import Ai from "./ai";
import { Loader2 } from "lucide-react";

interface AiSettingsDialogProps {
  orgSlug: string;
}

export function AiSettingsDialog({ orgSlug }: AiSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [orgData, setOrgData] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrgData = async () => {
    if (orgData) return; // Already loaded

    setIsLoading(true);
    try {
      const response = await fetch(`/api/org?slug=${orgSlug}`);
      const data: Organization = await response.json();
      setOrgData(data);
    } catch (error) {
      console.error("Failed to fetch organization data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && !orgData) {
      fetchOrgData();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Settings2 className="w-4 h-4 text-cyan-600 hover:text-cyan-700 cursor-pointer" />
      </DialogTrigger>
      <DialogContent className="min-w-[1026px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 hidden">
          <DialogTitle>AI Customization</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : orgData ? (
          <div className="px-0">
            <Ai org={orgData} />
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Failed to load organization data
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
