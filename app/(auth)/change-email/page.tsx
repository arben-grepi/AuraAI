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
          <h1 className="">Ändra e-post</h1>
          <p className="paragraph-small text-gray-500">
            Hantera ditt konto och uppdatera dina uppgifter nedan.
          </p>
        </div>
        <form className="max-w-[429px]" action={formAction}>
          <Label className="mb-2" htmlFor="email">
            Ny e-postadress
          </Label>
          <Input type="email" name="email" placeholder="E-post" />
          <Button type="submit" className="w-full mt-5" disabled={pending}>
            Ändra e-postadress
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
    return { error: "Ange en e-postadress" };
  }

  const { error } = await changeEmail({
    newEmail: email,
    callbackURL: "/dashboard",
  });

  if (error) {
    console.log("Change email error:", error);
    return {
      error:
        error.message || "Vi kunde inte ändra din e-post. Försök igen.",
    };
  }

  toast.success("Vi skickade ett mejl för att godkänna ändringen");
  return { error: "" };
}
