import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { env } from "@/env";

export const metadata: Metadata = {
  title: "Blog | IntelliDoc AI",
  description: "Read the latest insights, tutorials, and news about enterprise AI document intelligence.",
  alternates: {
    canonical: `${env.NEXT_PUBLIC_SITE_URL}/blog`,
  },
};

const posts = [
  {
    slug: "what-is-document-intelligence",
    title: "What is AI Document Intelligence?",
    excerpt: "Learn how modern AI is transforming static files into interactive, chatable knowledge bases for enterprise teams.",
    date: "August 4, 2026",
  }
];

export default function BlogIndexPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-[#FAFAFA] font-sans selection:bg-black/10 dark:selection:bg-white/20 px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Blog</h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-12">
          Insights on enterprise document intelligence, AI, and secure team collaboration.
        </p>
        
        <div className="grid gap-8">
          {posts.map((post) => (
            <article key={post.slug} className="group relative bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-2xl p-8 hover:border-black/10 dark:hover:border-white/10 transition-colors shadow-sm">
              <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-4">
                <h2 className="text-2xl font-semibold">
                  <Link href={`/blog/${post.slug}`} className="focus:outline-none">
                    <span className="absolute inset-0 rounded-2xl" aria-hidden="true" />
                    {post.title}
                  </Link>
                </h2>
                <time className="text-sm text-gray-500 dark:text-gray-400 mt-2 md:mt-0 whitespace-nowrap">
                  {post.date}
                </time>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                {post.excerpt}
              </p>
              <div className="inline-flex items-center text-sm font-medium text-black dark:text-white group-hover:underline">
                Read article <ArrowRight className="ml-2 w-4 h-4" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
