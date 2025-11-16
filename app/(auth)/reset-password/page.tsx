"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { resetPassword } from "@/lib/actions";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema } from "@/lib/schema";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  FormLabel,
} from "@/components/ui/form";

function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const formSchema = resetPasswordSchema
    .extend({
      confirmPassword: z.string().min(8, { error: "Password is required" }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });

  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: { newPassword: "", confirmPassword: "" },
    resolver: zodResolver(formSchema),
  });
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    const errorParam = searchParams.get("error");

    if (errorParam === "INVALID_TOKEN") {
      toast.error(
        "Invalid or expired reset token. Please request a new password reset.",
      );
      setIsValidToken(false);
    } else if (tokenParam) {
      setToken(tokenParam);
      setIsValidToken(true);
    } else {
      toast.error(
        "No reset token provided. Please use the link from your email.",
      );
      setIsValidToken(false);
    }
  }, [searchParams]);

  async function handleSubmit(values: z.infer<typeof formSchema>) {
    if (!token) {
      toast.error("No token provided");
      return;
    }

    const result = await resetPassword(
      { newPassword: values.newPassword },
      token,
    );

    const { success, data, error } = result;

    if (success) {
      toast.success(data?.data || "Password reset successfully");
      setTimeout(() => {
        router.push("/sign-in");
      }, 2000);
    } else {
      toast.error(error || "Failed to reset password");
    }
  }

  if (isValidToken === null) {
    return (
      <div className="flex flex-col gap-6 justify-center items-center h-screen bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Validating token...</p>
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="flex flex-col gap-6 justify-center items-center h-screen bg-neutral-50">
        <Card className="max-w-[350px] w-full border-none shadow-none bg-neutral-50 p-0">
          <CardHeader className="space-y-1">
            <p className="form-title">Invalid Token</p>
            <p className="form-description">
              The password reset link is invalid or has expired.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild className="form-submit-button user-select-none mt-4">
              <Link href="/forgot-password">
                Request New Reset Link
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50">
      <Card className="max-w-[350px] w-full border-none shadow-none bg-neutral-50 p-0">
        <CardHeader className="space-y-1">
          <p className="form-title">Reset Password</p>
          <p className="form-description">Enter your new password below.</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-7"
            >
              <FormField
                name="newPassword"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>New Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          className="form-input"
                          disabled={form.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent cursor-pointer"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={form.formState.isSubmitting}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <FormMessage className="form-message" />
                  </FormItem>
                )}
              />

              <FormField
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>Confirm Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          className="form-input"
                          disabled={form.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent cursor-pointer"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        disabled={form.formState.isSubmitting}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
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
                  ? "Resetting..."
                  : "Reset Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
