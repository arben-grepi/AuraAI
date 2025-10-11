import { DataTable } from "./data-table";
import { columns } from "./columns";
import { S3ObjectsAPIResponse } from "@/lib/types";

export default async function Page() {
  const data = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/files`, {
    next: { revalidate: 60 * 2, tags: ["files"] },
  });
  const res: S3ObjectsAPIResponse = await data.json();

  return (
    <div className="p-4">
      <DataTable columns={columns} data={res?.items || []} loading={false} />
    </div>
  );
}
