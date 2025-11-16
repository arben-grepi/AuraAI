import { auth } from "@/lib/auth";
import { APIError } from "better-auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const organizations = await auth.api.listOrganizations({
      headers: await headers(),
    });
    return NextResponse.json(organizations);
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to list organizations" },
      { status: 500 },
    );
  }
}
