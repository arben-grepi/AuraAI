import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { firstName, lastName, email, password } = await request.json();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const user = await auth.api.createUser({
      body: {
        email,
        password,
        name: `${firstName} ${lastName}`,
        role: "admin",
      },
    });

    if (!user?.user?.id) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, userId: user.user.id });
  } catch (error) {
    console.error("Failed to create admin:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create admin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
