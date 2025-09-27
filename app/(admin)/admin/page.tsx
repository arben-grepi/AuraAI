import CreateOrg from "@/components/admin/create-org";

export default async function Page() {
  const organizations = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/organizations`,
    { method: "GET" },
  );
  return (
    <div>
      <h1 className="text-2xl font-bold text-center mt-4">Admin Page</h1>
      <CreateOrg />
    </div>
  );
}
