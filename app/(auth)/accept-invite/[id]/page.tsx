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
          setErrorMessage(data.error || "Inbjudan hittades inte");
          setStatus("error");
          return;
        }

        setInvitation(data);
        setStatus("ready");
      } catch {
        setErrorMessage("Kunde inte ladda inbjudan");
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
        setErrorMessage(data.error || "Kunde inte acceptera inbjudan");
        setStatus("error");
        return;
      }

      setStatus("success");
      toast.success("Inbjudan accepterad!");

      if (data.organizationSlug) {
        router.push(`/org/${data.organizationSlug}/chat`);
      } else {
        router.push("/");
      }
    } catch {
      setErrorMessage("Kunde inte acceptera inbjudan");
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
              ? "Inbjudan accepterad"
              : status === "error"
                ? "Något gick fel"
                : "Organisationsinbjudan"}
          </h1>
        </CardHeader>
        <CardContent className="p-0">
          {status === "error" && (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-zinc-500">{errorMessage}</p>
              <Button onClick={() => router.push("/")} className="w-full">
                Gå till startsidan
              </Button>
            </div>
          )}

          {status === "ready" && invitation && (
            <div className="flex flex-col gap-4 text-center">
              <p className="text-sm text-zinc-500">
                Du har blivit inbjuden att gå med i{" "}
                <strong>{invitation.organizationName}</strong> som{" "}
                <strong>{invitation.role}</strong>.
              </p>
              <p className="text-sm text-zinc-400">
                Inbjuden av {invitation.inviterName || invitation.inviterEmail}
              </p>
              <Button
                onClick={handleAccept}
                className="w-full form-submit-button"
              >
                Acceptera inbjudan
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="w-full"
              >
                Avböj
              </Button>
            </div>
          )}

          {status === "accepting" && (
            <div className="flex flex-col items-center justify-center gap-2 py-4">
              <Loader className="size-4 animate-spin" />
              <p className="text-sm text-zinc-500">Accepterar inbjudan...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-zinc-500">
                Du är nu medlem i {invitation?.organizationName}.
              </p>
              <Loader className="size-4 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
