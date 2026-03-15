"use client";

import { useSearchParams } from "next/navigation";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { signUp } from "@/lib/actions";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export default function Page() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [showPassword, setShowPassword] = useState(false);
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
      toast.success(data?.data || "Ditt konto har skapats");
      setTimeout(() => {
        const signInUrl = callbackUrl
          ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
          : "/sign-in";
        window.location.href = signInUrl;
      }, 2000);
    } else {
      toast.error(error || "Kunde inte skapa konto");
    }
  }

  return (
    <div className="flex flex-col gap-6 justify-center items-center h-screen bg-neutral-50">
      <Card className="max-w-[350px] w-full bg-transparent border-none shadow-none">
        <CardHeader>
          <h1 className="text-center font-bold text-2xl leading-8 text-zinc-800">
            Skapa konto på Diguro
          </h1>
          <p className="text-center text-gray-500 text-sm">
            Skapa ett konto för din organisation
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>Förnamn</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ange ditt förnamn"
                        className="form-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="form-message" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>Efternamn</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ange ditt efternamn"
                        className="form-input"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="form-message" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel>E-post</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ange din e-post"
                        className="form-input"
                        {...field}
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
                    <FormLabel>Lösenord</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ange ditt lösenord"
                        className="form-input"
                        type={showPassword ? "text" : "password"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="form-message relative" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="absolute right-1 top-7.5 h-fit px-3 py-2 hover:bg-transparent cursor-pointer"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <AnimatePresence mode="wait">
                        {showPassword ? (
                          <motion.div
                            key="eye-off"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <EyeOff className="h-4 w-4" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="eye"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Eye className="h-4 w-4" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </FormItem>
                )}
              />
              <Button
                className="form-submit-button mt-4"
                disabled={form.formState.isSubmitting}
                type="submit"
              >
                {form.formState.isSubmitting ? "Skapar konto..." : "Skapa konto"}
              </Button>
              <p className="text-center font-normal text-base text-zinc-500">
                Har du redan ett konto?{" "}
                <Link
                  className="text-black"
                  href={
                    callbackUrl
                      ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
                      : "/sign-in"
                  }
                >
                  Logga in
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
