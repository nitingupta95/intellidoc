"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An error occurred");
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
          <h1 className="text-3xl font-heading font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your knowledge base
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm text-center">
            {error}
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" htmlFor="password">Password</label>
              <Link href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                Forgot password?
              </Link>
            </div>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 bg-background/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button className="w-full font-medium cursor-pointer" size="lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            Sign In
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground glass rounded-md">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="glass bg-transparent hover:bg-background/50 cursor-pointer" 
            disabled={githubLoading || googleLoading || loading}
            onClick={() => {
              setGithubLoading(true);
              signIn("github");
            }}
          >
            {githubLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            GitHub
          </Button>
          <Button 
            variant="outline" 
            className="glass bg-transparent hover:bg-background/50 cursor-pointer" 
            disabled={googleLoading || githubLoading || loading}
            onClick={() => {
              setGoogleLoading(true);
              signIn("google");
            }}
          >
            {googleLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            Google
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium cursor-pointer">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
