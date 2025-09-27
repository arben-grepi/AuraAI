"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createOrganizationSchema } from "@/lib/schema";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../ui/dialog";
import { SidebarSeparator } from "../ui/sidebar";
import { Switch } from "../ui/switch";
import { toast } from "sonner";
import { createOrganization } from "@/lib/actions";
import { useState } from "react";

export default function CreateOrg() {
  const [dialog, setDialog] = useState(false);
  const form = useForm<z.infer<typeof createOrganizationSchema>>({
    defaultValues: {
      name: "",
      slug: "",
      logo: "",
      keepCurrentActiveOrganization: false,
    },
    resolver: zodResolver(createOrganizationSchema),
  });
  const onSubmit = async (values: z.infer<typeof createOrganizationSchema>) => {
    console.log(values);
    const { data, error, success } = await createOrganization(values);
    if (success) {
      toast.success(data?.data || "Organization created");
    } else {
      toast.error(error || "Failed to create organization");
    }
    form.reset();
    setDialog(false);
  };

  return (
    <Dialog open={dialog} onOpenChange={setDialog}>
      <DialogTrigger>Create Organization</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>Create a new organization</DialogDescription>
        </DialogHeader>
        <SidebarSeparator />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="keepCurrentActiveOrganization"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Keep Current Active Organization
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Create Organization
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
