"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/actions";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordResetSchema } from "@/lib/schema";
import {
  Form,
  FormLabel,
  FormMessage,
  FormControl,
  FormItem,
  FormField,
} from "@/components/ui/form";

export default function Page() {
  const form = useForm<z.infer<typeof requestPasswordResetSchema>>({
    defaultValues: {
      email: "",
    },
    resolver: zodResolver(requestPasswordResetSchema),
  });

  async function onSubmit(values: z.infer<typeof requestPasswordResetSchema>) {
    const result = await requestPasswordReset(
      values,
      `${window.location.origin}/reset-password`,
    );

    const { success, data, error } = result;

    if (success) {
      toast.success(data?.data || "E-post för lösenordsåterställning skickad");
    } else {
      toast.error(error || "Kunde inte skicka återställningsmejl");
    }
  }
  return (
    <div className="flex flex-col gap-6 justify-center items-center h-screen bg-neutral-50">
      <Card className="max-w-[350px] w-full border-none shadow-none bg-neutral-50 p-0">
        <CardHeader className="space-y-1">
          <p className="form-title">Glömt lösenord</p>
          <p className="form-description">
            Ange din e-postadress så skickar vi en länk för att återställa ditt
            lösenord.
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel htmlFor="email">E-post</FormLabel>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        className="form-input"
                        placeholder="Ange din e-postadress"
                        required
                        disabled={form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="form-message" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="form-submit-button user-select-none mt-4"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? "Skickar..."
                  : "Skicka återställningsmejl"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
