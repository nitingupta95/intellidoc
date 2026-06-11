"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "An error occurred");
      } else {
        setSuccess(data.message || "Password reset link sent successfully!");
        setEmail(""); // clear the email
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <div className="glass-panel max-w-md w-full p-8 space-y-6 z-10 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-[-50px] left-[-50px] w-[150px] h-[150px] bg-primary/20 blur-[60px] rounded-full pointer-events-none" />

        <div className="text-center space-y-2">
          <div className="flex justify-center pb-4">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <BrainCircuit className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Forgot Password</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll send a password reset link to your email.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-500 text-sm text-center">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" 
              required
              className="w-full px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <Button className="w-full font-medium cursor-pointer" size="lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            Send Reset Link
          </Button>
        </form>

        <div className="text-center mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
