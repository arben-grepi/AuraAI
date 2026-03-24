"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";

export default function AcceptInvitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const [status, setStatus] = useState<
    "loading" | "ready" | "accepting" | "success" | "error"
  >("loading");
  const [invitation, setInvitation] = useState<{
    organizationName: string;
    organizationSlug: string;
    inviterEmail: string;
    inviterName: string;
    role: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (sessionLoading) return;

    if (!session) {
      window.location.href = `/sign-in?callbackUrl=/accept-invite/${id}`;
      return;
    }

    async function fetchInvitation() {
      try {
        const res = await fetch(`/api/invite/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setErrorMessage(data.error || "Invitation not found");
          setStatus("error");
          return;
        }

        setInvitation(data);
        setStatus("ready");
      } catch {
        setErrorMessage("Could not load invitation");
        setStatus("error");
      }
    }

    fetchInvitation();
  }, [session, sessionLoading, id, router]);

  const handleAccept = async () => {
    setStatus("accepting");
    try {
      const res = await fetch(`/api/invite/${id}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Could not accept invitation");
        setStatus("error");
        return;
      }

      setStatus("success");
      toast.success("Invitation accepted!");

      if (data.organizationSlug) {
        router.push(`/org/${data.organizationSlug}/chat`);
      } else {
        router.push("/");
      }
    } catch {
      setErrorMessage("Could not accept invitation");
      setStatus("error");
    }
  };

  if (sessionLoading || status === "loading") {
    return (
      <div className="flex justify-center items-center h-screen bg-neutral-50">
        <Loader className="size-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 justify-center items-center h-screen bg-neutral-50">
      <Card className="max-w-[400px] w-full border-none shadow-none bg-neutral-50 p-0">
        <CardHeader className="text-center">
          <h1 className="form-title">
            {status === "success"
              ? "Invitation accepted"
              : status === "error"
                ? "Something went wrong"
                : "Organization invitation"}
          </h1>
        </CardHeader>
        <CardContent className="p-0">
          {status === "error" && (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-zinc-500">{errorMessage}</p>
              <Button onClick={() => router.push("/")} className="w-full">
                Go to home page
              </Button>
            </div>
          )}

          {status === "ready" && invitation && (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-zinc-500">
                You have been invited to join{" "}
                <strong>{invitation.organizationName}</strong> som{" "}
                <strong>{invitation.role}</strong>.
              </p>
              <p className="text-sm text-zinc-400">
                Invited by {invitation.inviterName || invitation.inviterEmail}
              </p>
              <Button
                onClick={handleAccept}
                className="w-full form-submit-button"
              >
                Accept invitation
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="w-full"
              >
                Decline
              </Button>
            </div>
          )}

          {status === "accepting" && (
            <div className="flex flex-col items-center justify-center gap-2 py-4">
              <Loader className="size-4 animate-spin" />
              <p className="text-sm text-zinc-500">Accepting invitation...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-zinc-500">
                You are now a member of {invitation?.organizationName}.
              </p>
              <Loader className="size-4 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
