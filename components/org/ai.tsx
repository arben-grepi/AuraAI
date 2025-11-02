"use client";

import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { Organization } from "better-auth/plugins";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import { cn } from "@/lib/utils";
import OrgFilesList from "./org-files-list";

export default function Ai({ org }: { org: Organization }) {
  const metadata =
    typeof org.metadata === "string"
      ? JSON.parse(org.metadata)
      : org.metadata || {};

  const [aiTone, setAiTone] = useState<
    "professional" | "friendly" | "analytical" | "creative"
  >(metadata?.tone || "professional");

  const tones = [
    {
      label: "Professional",
      value: "professional",
    },
    {
      label: "Friendly",
      value: "friendly",
    },
    {
      label: "Analytical",
      value: "analytical",
    },
    {
      label: "Creative",
      value: "creative",
    },
  ];

  return (
    <div>
      <div className="w-full flex justify-between px-8 py-10 border-b border-zinc-200">
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-xl">Organization Information</h1>
        </div>
        <div className="flex gap-3">
          <Button variant={"outline"} className="w-fit py-5">
            Save Changes
          </Button>
        </div>
      </div>
      <div className="px-8 py-10">
        <div className="flex flex-col gap-1 mb-4">
          <p className="text-sm font-medium">AI Tone</p>
          <p className="text-zinc-600 text-sm font-medium">
            Some placeholder text here
          </p>
        </div>
        <div className="flex gap-2">
          {tones.map((tone, i) => (
            <div
              key={i}
              onClick={() =>
                setAiTone(
                  tone.value as
                    | "professional"
                    | "friendly"
                    | "analytical"
                    | "creative",
                )
              }
              className={cn(
                "rounded-full border border-zinc-200 px-4 py-3 shadow-xs cursor-pointer transition-all duration-200",
                aiTone === tone.value
                  ? "bg-primary !text-white"
                  : "bg-transparent !text-zinc-800",
              )}
            >
              <p
                className={cn(
                  "font-medium text-sm",
                  aiTone === tone.value ? "text-white" : "text-zinc-800",
                )}
              >
                {tone.label}
              </p>
            </div>
          ))}
        </div>
        <OrgFilesList orgId={org.id} />
      </div>
    </div>
  );
}
