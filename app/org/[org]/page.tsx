import { redirect } from "next/navigation";
import { normalizeSlugParam } from "@/lib/utils";

export default async function Page(props: PageProps<"/org/[org]">) {
  const { org: orgRaw } = await props.params;
  const org = normalizeSlugParam(orgRaw);

  redirect(`/org/${org}/chat`);
}
