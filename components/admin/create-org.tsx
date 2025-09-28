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
import { Uploader } from "../upload";
import { Plus } from "lucide-react";

interface CreateOrgProps {
  onSuccess: () => void;
}

export default function CreateOrg({ onSuccess }: CreateOrgProps) {
  const [dialog, setDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const form = useForm<z.infer<typeof createOrganizationSchema>>({
    defaultValues: {
      name: "",
      logo: "",
      keepCurrentActiveOrganization: false,
    },
    resolver: zodResolver(createOrganizationSchema),
  });
  const onSubmit = async (values: z.infer<typeof createOrganizationSchema>) => {
    const { data, error, success } = await createOrganization(values);
    if (success) {
      toast.success(data?.data || "Organization created");
      onSuccess();
    } else {
      toast.error(error || "Failed to create organization");
    }
    form.reset();
    setDialog(false);
  };

  return (
    <Dialog open={dialog} onOpenChange={setDialog}>
      <DialogTrigger asChild>
        <div className="p-2 bg-chart-3/20 rounded-lg cursor-pointer hover:scale-105 transition-all duration-200">
          <Plus className="w-5 h-5 text-chart-3" />
        </div>
      </DialogTrigger>
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
              name="logo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo</FormLabel>
                  <FormControl>
                    <Uploader
                      onUploadComplete={(fileUrls) =>
                        field.onChange(fileUrls[0])
                      }
                      onPendingChange={setIsUploading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="keepCurrentActiveOrganization"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg p-4">
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
            <Button type="submit" className="w-full" disabled={isUploading}>
              {isUploading ? "Uploading..." : "Create Organization"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
