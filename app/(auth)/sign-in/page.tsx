"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/actions";
import { toast } from "sonner";
import { redirect } from "next/navigation";
import Image from "next/image";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SidebarSeparator } from "@/components/ui/sidebar";
import Link from "next/link";

export default function Page() {
  const form = useForm<z.infer<typeof signInSchema>>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(signInSchema),
  });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    const result = await signIn(values);

    const { success, data, error } = result;

    if (success) {
      toast.success(data?.data || "You signed in successfully");
      setTimeout(() => {
        redirect("/");
      }, 2000);
    } else {
      toast.error(error || "Failed to sign in");
    }
  }

  return (
    <div className="flex flex-col gap-6 justify-center items-center h-screen">
      <Card className="max-w-md w-full">
        <CardHeader>
          <Image
            className="mb-8 mx-auto"
            src="/logo.svg"
            alt="Axiom"
            width={50}
            height={50}
          />
          <CardTitle className="text-center">Sign in to your account</CardTitle>
          <CardDescription className="text-center">
            Enter your email below to sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                className="w-full cursor-pointer"
                disabled={form.formState.isSubmitting}
                type="submit"
              >
                {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
              <Link
                className="text-sm font-medium text-primary hover:underline block text-center"
                href={"/forgot-password"}
              >
                Forgot password?
              </Link>
              <SidebarSeparator />
              <p className="text-center font-medium text-sm">
                Don&apos;t have an account? <Link href="/sign-up">Sign up</Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
