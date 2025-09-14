import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardTitle, CardHeader, CardContent } from "../ui/card";
import { SignOutButton } from "./sign-out-button";
import Link from "next/link";

export default async function UserInfo() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return (
    <Card className="max-w-[500px]">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>User Info</CardTitle>
        <Link href="/chat">Chat</Link>
        <SignOutButton />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p>ID: {session?.user?.id}</p>
        <p>Email: {session?.user?.email}</p>
        <p>Name: {session?.user?.name}</p>
        <p>Image: {session?.user?.image}</p>
        <p>Email Verified: {session?.user?.emailVerified}</p>
      </CardContent>
    </Card>
  );
}
