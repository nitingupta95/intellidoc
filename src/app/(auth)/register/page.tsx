"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed");
      }

      // Redirect to OTP verification page
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
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
          <h1 className="text-3xl font-heading font-bold tracking-tight">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Join IntelliDoc AI to build your knowledge base
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="name">Full Name</label>
            <input 
              id="name"
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe" 
              required
              className="w-full px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
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
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button className="w-full font-medium" size="lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            Sign Up
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
