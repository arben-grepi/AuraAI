"use client";

import { Input } from "@/components/ui/input";
import { useActionState, useEffect } from "react";
import { changeEmail } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function Page() {
  const initialState = { error: "" };

  const [state, formAction, pending] = useActionState(
    changeUserEmail,
    initialState,
  );

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.error]);

  return (
    <div className="cc">
      <div className="space-y-10">
        <div className="space-y-2">
          <h1 className="">Change Email</h1>
          <p className="paragraph-small text-gray-500">
            Manage your account and update your details below.
          </p>
        </div>
        <form className="max-w-[429px]" action={formAction}>
          <Label className="mb-2" htmlFor="email">
            New Email Address
          </Label>
          <Input type="email" name="email" placeholder="Email" />
          <Button type="submit" className="w-full mt-5" disabled={pending}>
            Change Email Address
          </Button>
        </form>
      </div>
    </div>
  );
}

async function changeUserEmail(
  prevState: { error: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const rawFormData = {
    email: formData.get("email") as string,
  };

  const { email } = rawFormData;

  if (!email) {
    return { error: "Please enter an email address" };
  }

  const { error } = await changeEmail({
    newEmail: email,
    callbackURL: "/dashboard",
  });

  if (error) {
    console.log("Change email error:", error);
    return {
      error:
        error.message || "We couldn't change your email. Please try again.",
    };
  }

  toast.success("We sent you an email to approve the change");
  return { error: "" };
}
