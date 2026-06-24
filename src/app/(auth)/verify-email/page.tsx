"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Loader2 } from "lucide-react";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Email address is missing.");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      // Use NextAuth signIn with custom isVerification flag
      const signInRes = await signIn("credentials", {
        redirect: false,
        email,
        otp,
        isVerification: "true",
      });

      if (signInRes?.error) {
        throw new Error(signInRes.error === "CredentialsSignin" ? "Invalid or expired OTP." : signInRes.error);
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <div className="glass-panel max-w-md w-full p-8 space-y-6 z-10 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-blue-500/20 blur-[60px] rounded-full pointer-events-none" />

        <div className="text-center space-y-2">
          <div className="flex justify-center pb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <BrainCircuit className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Verify Email</h1>
          <p className="text-sm text-muted-foreground">
            We've sent a 6-digit code to <br/>
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="otp">Verification Code</label>
            <input 
              id="otp"
              type="text" 
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="123456" 
              required
              className="w-full px-3 py-3 text-center text-2xl tracking-[0.5em] bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button className="w-full font-medium" size="lg" disabled={loading || otp.length !== 6}>
            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            Verify & Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
