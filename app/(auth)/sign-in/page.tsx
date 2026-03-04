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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";

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
      toast.success(data?.data || "Du loggade in");
      setTimeout(() => {
        redirect("/");
      }, 1000);
    } else {
      toast.error(error || "Kunde inte logga in");
    }
  }

  return (
    <div className="flex flex-col gap-6 justify-center items-center h-screen bg-neutral-50">
      <Card className="max-w-[350px] w-full border-none shadow-none bg-neutral-50 p-0">
        <CardHeader>
          <h1 className="form-title">Logga in på Diguro</h1>
          <p className="form-description">
            Logga in på ditt organisationskonto
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Form {...form}>
            <form
              className="flex flex-col gap-8"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>E-postadress</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="form-input"
                        placeholder="Ange din e-postadress"
                        onBlur={field.onBlur}
                        type="email"
                      />
                    </FormControl>
                    <FormMessage className="form-message" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel className="flex items-center justify-between">
                      <p>Lösenord</p>
                      <Link
                        className="text-sm text-zinc-500 underline block text-center"
                        href={"/forgot-password"}
                      >
                        Glömt lösenord?
                      </Link>
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="form-input"
                        placeholder="Ange ditt lösenord"
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="form-message" />
                  </FormItem>
                )}
              />
              <Button
                className="form-submit-button"
                disabled={form.formState.isSubmitting}
                type="submit"
              >
                {form.formState.isSubmitting ? "Loggar in..." : "Logga in"}
              </Button>
              <p className="text-center font-normal text-base text-zinc-500">
                Har du inget konto?{" "}
                <Link className="text-black" href="/sign-up">
                  Skapa konto
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
