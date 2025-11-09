import { redirect } from "next/navigation";

export default async function Page(props: PageProps<"/org/[org]">) {
  const { org } = await props.params;

  redirect(`/org/${org}/chat`);
}
