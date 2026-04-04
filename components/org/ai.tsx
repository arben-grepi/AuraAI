"use client";

import { Organization } from "@/lib/types";
import OrgFilesList from "./org-files-list";

/**
 * Organization "AI" settings: knowledge base files only.
 * Assistant behaviour is fixed in code (documentation-grounded replies); see getSystemPrompt in lib/utils.ts.
 */
export default function Ai({ org }: { org: Organization }) {
  return (
    <div>
      <div className="w-full flex justify-between px-8 py-10 border-b border-zinc-200">
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-xl">Knowledge base</h1>
          <p className="text-sm text-zinc-600 max-w-xl">
            Upload documents the assistant can search. Answers are generated only from this
            material, not from open-ended general knowledge.
          </p>
        </div>
      </div>
      <div className="px-8 py-10">
        <OrgFilesList orgId={org.id} />
      </div>
    </div>
  );
}
