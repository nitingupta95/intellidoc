import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-[#FAFAFA] font-sans selection:bg-black/10 dark:selection:bg-white/20 flex items-center justify-center px-6 py-24">
      <div className="max-w-md w-full text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center mb-6">
          <FileQuestion className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        
        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          The page or document you are looking for doesn't exist or has been moved. Let's get you back to safety.
        </p>
        
        <Button asChild size="lg" className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-full px-8">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return Home
          </Link>
        </Button>
      </div>
    </main>
  );
}
