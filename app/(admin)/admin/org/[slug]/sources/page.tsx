import { Organization } from "@/lib/types";
import { notFound } from "next/navigation";
import Sources from "@/components/org/sources";

export default async function Page(
  props: PageProps<"/admin/org/[slug]/sources">,
) {
  const { slug } = await props.params;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/org?slug=${slug}`,
  );

  const orgData: Organization = await response.json();

  if (!orgData.id) {
    return notFound();
  }

  return (
    <div>
      <Sources orgSlug={slug} />
    </div>
  );
}
