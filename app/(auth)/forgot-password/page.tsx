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
      toast.success(data?.data || "Password reset email sent");
    } else {
      toast.error(error || "Failed to send reset email");
    }
  }
  return (
    <div className="flex flex-col gap-6 justify-center items-center h-screen bg-neutral-50">
      <Card className="max-w-[350px] w-full border-none shadow-none bg-neutral-50 p-0">
        <CardHeader className="space-y-1">
          <p className="form-title">Forgot Password</p>
          <p className="form-description">
            Enter your email address and we&apos;ll send you a link to reset
            your password.
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
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        className="form-input"
                        placeholder="Enter your email address"
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
                  ? "Sending..."
                  : "Send Reset Email"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
