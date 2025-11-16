"use client";

import { Button } from "../ui/button";
import { Organization } from "@/lib/types";
import { useState } from "react";
import { cn } from "@/lib/utils";
import OrgFilesList from "./org-files-list";
import { toast } from "sonner";
import { handleUpdateOrganizationTone } from "@/lib/actions";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { handleUpdateOrganizationSystemPrompt } from "@/lib/actions";

export default function Ai({ org }: { org: Organization }) {
  const [aiTone, setAiTone] = useState<string>(org.tone || "professional");
  const [systemPrompt, setSystemPrompt] = useState<string>(
    org.systemPrompt || "",
  );

  const hasChanges = systemPrompt !== (org.systemPrompt || "");

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

  const handleToneChange = async (tone: string) => {
    setAiTone(tone);
    if (tone === aiTone) return;
    const result = await handleUpdateOrganizationTone(org.id, tone);
    if (result?.success) {
      toast.success(result?.data?.data || "Organization tone updated");
    } else {
      toast.error(result?.error || "Failed to update organization tone");
      setAiTone(aiTone);
    }
  };

  const handleSaveChanges = async () => {
    const result = await handleUpdateOrganizationSystemPrompt({
      organizationId: org.id,
      systemPrompt: systemPrompt,
    });
    if (result?.success) {
      toast.success(result?.data?.data || "System prompt updated");
    } else {
      toast.error(result?.error || "Failed to update system prompt");
      setSystemPrompt(systemPrompt);
    }
  };

  return (
    <div>
      <div className="w-full flex justify-between px-8 py-10 border-b border-zinc-200">
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-xl">Organization Information</h1>
        </div>
        <div className="flex gap-3">
          <Button
            variant={"outline"}
            className="w-fit py-5"
            onClick={handleSaveChanges}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </div>
      </div>
      <div className="px-8 py-10">
        <div className="flex flex-col gap-1 mb-4">
          <p className="text-sm font-medium">AI Tone</p>
          <p className="text-zinc-600 text-sm font-medium">
            Choose the tone of the AI responses for your organization
          </p>
        </div>
        <div className="flex gap-2">
          {tones.map((tone, i) => (
            <div
              key={i}
              onClick={() => handleToneChange(tone.value)}
              className={cn(
                "rounded-full border border-zinc-200 px-4 py-3 shadow-xs cursor-pointer transition-all duration-200",
                aiTone === tone.value
                  ? "bg-primary text-white!"
                  : "bg-transparent text-zinc-800!",
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
        <div className="flex flex-col gap-1 mb-4 mt-10">
          <Label htmlFor="systemPrompt">How this AI should behave?</Label>
          <Textarea
            name="systemPrompt"
            rows={8}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="form-input bg-white mt-3! min-w-[300px] max-w-[500px]"
            placeholder="Enter your system prompt"
          />
        </div>
        <OrgFilesList orgId={org.id} />
      </div>
    </div>
  );
}
