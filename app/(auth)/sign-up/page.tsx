"use client";

import { redirect } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signUp } from "@/lib/actions";
import { toast } from "sonner";
import Image from "next/image";
import { SidebarSeparator } from "@/components/ui/sidebar";
import Link from "next/link";

export default function Page() {
  const form = useForm<z.infer<typeof signUpSchema>>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
    resolver: zodResolver(signUpSchema),
  });

  async function onSubmit(values: z.infer<typeof signUpSchema>) {
    const result = await signUp(values);

    const { success, data, error } = result;

    if (success) {
      toast.success(data?.data || "You signed up successfully");
      setTimeout(() => {
        redirect("/sign-in");
      }, 2000);
    } else {
      toast.error(error || "Failed to sign up");
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
          <CardTitle className="text-center">Sign up to your account</CardTitle>
          <CardDescription className="text-center">
            Enter your email below to sign up to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="flex justify-between gap-2 items-center">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input {...field} />
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
                {form.formState.isSubmitting ? "Signing up..." : "Sign up"}
              </Button>
              <SidebarSeparator />
              <p className="text-center font-medium text-sm">
                Already have an account? <Link href="/sign-in">Sign in</Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
