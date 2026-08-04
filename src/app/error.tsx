"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service like Sentry or Crashlytics in production
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-[#FAFAFA] font-sans selection:bg-black/10 dark:selection:bg-white/20 flex items-center justify-center px-6 py-24">
      <div className="max-w-md w-full text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-900/50 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight mb-4">Something went wrong</h1>
        
        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          An unexpected error occurred. We've been notified and are looking into it.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Button 
            onClick={() => reset()}
            className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-full px-8"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          
          <Button 
            asChild 
            variant="outline" 
            className="bg-transparent border-black/10 hover:bg-black/5 text-gray-900 dark:border-white/10 dark:hover:bg-white/5 dark:text-white rounded-full px-8"
          >
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
