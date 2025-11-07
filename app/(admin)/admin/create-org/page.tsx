"use client";

import { cn } from "@/lib/utils";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { useRef, useState } from "react";
import { z } from "zod";
import { createOrganizationSchema } from "@/lib/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { SquareDashed } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

const bgColors = ["#F4F4F5", "#D9E9F9", "#FE1B8F", "#9182FF"];
const buttonColors = ["#06b6d4", "#10B981", "#F59E0B", "#EF4444"];

export default function Page() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isUploading, setIsUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [orgLogo, setOrgLogo] = useState<string | null>("");
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof createOrganizationSchema>>({
    defaultValues: {
      name: "",
      description: "",
      keepCurrentActiveOrganization: false,
      backgroundColor: "",
      buttonColor: "",
    },
    resolver: zodResolver(createOrganizationSchema),
  });

  const name = form.watch("name");
  const description = form.watch("description");
  const onSubmit = async (values: z.infer<typeof createOrganizationSchema>) => {
    setIsLoading(true);
    console.log("onSubmit");
    console.log(values);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const handleUploadLogo = async () => {
    const file = logoInputRef.current?.files?.[0];
    if (file) {
      setIsUploading(true);
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Logo size should be less than 5MB");
        setIsUploading(false);
        return;
      }
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        toast.error("Logo type should be JPEG or PNG");
        setIsUploading(false);
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        toast.error("Failed to upload logo");
        setIsUploading(false);
        return;
      }
      const data = await response.json();
      setOrgLogo(data.url || "");
      toast.success("Logo uploaded successfully");
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-neutral-50 h-screen p-25 flex">
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-gray-700 font-medium">Step {step} of 3</p>
          <div className="flex gap-1 w-full max-w-[300px]">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "w-1 h-2 rounded-full bg-zinc-300 flex-1 transition-all duration-200",
                  step >= index + 1 ? "bg-cyan-600" : "bg-zinc-300",
                )}
              ></div>
            ))}
          </div>
        </div>
        <div>
          <p className="font-bold text-2xl text-zinc-800">
            {step === 1
              ? "Create a new organization"
              : step === 2
                ? "Branding"
                : "Users"}
          </p>
          <p className="text-sm text-gray-700">
            {step === 1
              ? "Create a new organization to manage your users"
              : step === 2
                ? "Brand your organization to make it your own"
                : "Add users to your organization"}
          </p>
        </div>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {step === 1 && (
                <AnimatePresence mode="wait">
                  <motion.div
                    className="space-y-6"
                    key="step-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="relative">
                          <FormLabel>Organization name</FormLabel>
                          <FormControl>
                            <Input
                              className="form-input max-w-[300px]"
                              placeholder="Enter your organization name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="form-message" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="relative">
                          <FormLabel>Organization description</FormLabel>
                          <FormControl>
                            <Textarea
                              className="form-input pt-3! max-w-[400px] focus:ring-0 focus-visible:ring-0 bg-white"
                              rows={8}
                              placeholder="Enter your organization description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="form-message" />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                </AnimatePresence>
              )}
              {step === 2 && (
                <AnimatePresence mode="wait">
                  <motion.div
                    className="space-y-6"
                    key="step-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="logo">Organization Logo</Label>
                      <div className="border border-zinc-200 rounded-[12px] bg-white w-[238px] h-[178px] flex flex-col">
                        <div className="flex-1 relative flex items-center justify-center">
                          {isUploading ? (
                            <Loader2 className="w-8 h-8 animate-spin" />
                          ) : (
                            <Image
                              className="object-cover"
                              src={orgLogo || "/placeholder.svg"}
                              alt="Organization Logo"
                              width={100}
                              height={100}
                            />
                          )}
                        </div>
                        <div
                          onClick={() => {
                            if (isUploading) return;
                            logoInputRef.current?.click();
                          }}
                          className={`${isUploading ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} flex items-center justify-center gap-2 py-3 border-t border-zinc-200`}
                        >
                          <p className="text-sm text-zinc-800 font-medium">
                            Upload logo
                          </p>
                          <input
                            id="logo-input"
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleUploadLogo}
                            ref={logoInputRef}
                          />
                          <Upload className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="backgroundColor">
                        Background color (UI)
                      </Label>
                      <p className="text-sm text-gray-700 font-medium">
                        Choose a background color for your organization
                      </p>
                      <div className="flex gap-3">
                        {bgColors.map((color) => (
                          <div
                            key={color}
                            className={`w-[106px] h-[64px] rounded-[4px] cursor-pointer ${form.watch("backgroundColor") === color ? "outline-2 outline-gray-300" : ""}`}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              form.setValue("backgroundColor", color);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </form>
          </Form>
          <Button
            disabled={step === 1 ? !name || !description : false || isLoading}
            onClick={async () => {
              if (step === 2) {
                if (!orgLogo) {
                  toast.error("Please upload a logo");
                  return;
                }
                form.setValue("logo", orgLogo);
                form.setValue("backgroundColor", "#ffffff");
                form.setValue("buttonColor", "#06b6d4");
                await form.handleSubmit(onSubmit)();
              } else if (step < 3) {
                setStep((step + 1) as 1 | 2 | 3);
              }
            }}
            className="bg-cyan-600 text-white w-full max-w-[400px] mt-8 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Next"}
          </Button>
        </div>
      </div>
      <div className="flex-1">
        <div
          className="w-full bg-zinc-100 h-[200px] rounded-[12px] border border-zinc-200 flex flex-col gap-4 px-8 py-5"
          style={{ backgroundColor: form.watch("backgroundColor") }}
        >
          {orgLogo ? (
            <Image
              src={orgLogo}
              alt="Organization Logo"
              width={80}
              height={80}
              className="rounded-[12px] object-cover"
            />
          ) : (
            <div className="w-[80px] h-[80px] rounded-[12px] bg-zinc-200 flex items-center justify-center">
              <SquareDashed className="w-4 h-4 text-zinc-500" />
            </div>
          )}
          <div className="w-full flex items-center justify-between">
            <div className="flex flex-col">
              {name ? (
                <p className="text-base font-medium text-zinc-800">{name}</p>
              ) : (
                <p className="text-base font-medium text-zinc-500">
                  Organization name
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
