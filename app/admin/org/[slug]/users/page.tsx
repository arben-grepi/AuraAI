import Users from "@/components/org/users";
import { Organization } from "@/lib/types";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page(
  props: PageProps<"/admin/org/[slug]/users">,
) {
  const { slug } = await props.params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return notFound();
  }

  const userId = session.user.id;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/org?slug=${slug}`,
  );

  const orgData: Organization = await response.json();

  if (!orgData.id) {
    return notFound();
  }

  return (
    <div>
      <Users org={orgData} userId={userId} />
    </div>
  );
}
