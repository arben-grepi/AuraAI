import { Organization } from "better-auth/plugins";
import General from "@/components/org/general";
import { notFound } from "next/navigation";

export default async function Page(props: PageProps<"/admin/org/[slug]">) {
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
      <General org={orgData} />
    </div>
  );
}
