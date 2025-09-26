import { Button } from "@/components/ui/button";
import { sendVerificationEmail } from "@/lib/auth-client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const handleVerifyEmail = async () => {
    "use server";
    const { error } = await sendVerificationEmail({
      email: session?.user?.email as string,
      callbackURL: "/",
    });
    if (error) {
      console.log("Verify email error:", error);
    }
  };

  return (
    <div className="flex flex-col gap-6 justify-center items-center h-screen">
      <form action={handleVerifyEmail}>
        <h1>Verify Email</h1>
        <Button type="submit">Verify Email</Button>
      </form>
    </div>
  );
}
