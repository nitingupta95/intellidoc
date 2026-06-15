"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [invite, setInvite] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const data = await res.json();
        if (res.ok) {
          setInvite(data.invitation);
        } else {
          setError(data.error || "Invalid invitation");
        }
      } catch (err) {
        setError("An error occurred");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Invitation accepted!");
        router.push("/dashboard");
      } else {
        toast.error(data.error || "Failed to accept invitation");
      }
    } catch (err) {
      toast.error("An error occurred while accepting");
    } finally {
      setIsAccepting(false);
    }
  };

  if (isLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full glass-panel p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Invalid Invitation</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button asChild className="w-full mt-4">
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full glass-panel p-8 text-center space-y-4">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold font-heading">Sign in required</h1>
          <p className="text-muted-foreground">
            You have been invited to join the workspace <strong>{invite?.workspace?.name}</strong>.
            Please sign in with <strong>{invite?.email}</strong> to accept.
          </p>
          <Button asChild className="w-full mt-4">
            <Link href={`/login?callbackUrl=/invite/${token}`}>Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full glass-panel p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mx-auto mb-4 border border-primary/30">
          <Building2 size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Join Workspace</h1>
          <p className="text-muted-foreground">
            You have been invited to join <strong>{invite?.workspace?.name}</strong> as a {invite?.role?.toLowerCase()}.
          </p>
        </div>
        
        {session.user?.email !== invite?.email && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg text-left">
            <strong>Warning:</strong> You are signed in as {session.user?.email}, but this invitation is for {invite?.email}. You may not be able to accept it.
          </div>
        )}

        <Button 
          className="w-full h-12 text-lg font-medium"
          onClick={handleAccept}
          disabled={isAccepting || session.user?.email !== invite?.email}
        >
          {isAccepting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Accepting...
            </>
          ) : "Accept Invitation"}
        </Button>
      </div>
    </div>
  );
}
