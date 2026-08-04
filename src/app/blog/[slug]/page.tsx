import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { env } from "@/env";
import { notFound } from "next/navigation";

// Hardcoded for Phase 8 demonstration
const dummyPost = {
  slug: "what-is-document-intelligence",
  title: "What is AI Document Intelligence?",
  excerpt: "Learn how modern AI is transforming static files into interactive, chatable knowledge bases for enterprise teams.",
  content: `
    <p>In the modern enterprise, documents are no longer just static files sitting in a folder. With AI document intelligence, they become interactive knowledge bases.</p>
    <h2>Transforming Static Data into Insights</h2>
    <p>By leveraging advanced embedding models and large language models (LLMs), platforms like IntelliDoc AI can instantly semantically search through thousands of pages to find the exact paragraph you need.</p>
    <h2>Citation-Backed Accuracy</h2>
    <p>Unlike raw LLMs which can hallucinate, a true document intelligence platform grounds its answers in your specific uploaded files and provides exact citations.</p>
  `,
  date: "August 4, 2026",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  
  if (slug !== dummyPost.slug) {
    return { title: "Post Not Found" };
  }

  return {
    title: `${dummyPost.title} | IntelliDoc AI Blog`,
    description: dummyPost.excerpt,
    alternates: {
      canonical: `${env.NEXT_PUBLIC_SITE_URL}/blog/${slug}`,
    },
    openGraph: {
      title: dummyPost.title,
      description: dummyPost.excerpt,
      type: "article",
      url: `${env.NEXT_PUBLIC_SITE_URL}/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  
  if (slug !== dummyPost.slug) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-[#FAFAFA] font-sans selection:bg-black/10 dark:selection:bg-white/20 px-6 py-24">
      <article className="max-w-3xl mx-auto">
        <Link href="/blog" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Blog
        </Link>
        
        <header className="mb-12">
          <time className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 block">
            {dummyPost.date}
          </time>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            {dummyPost.title}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
            {dummyPost.excerpt}
          </p>
        </header>

        <div 
          className="prose prose-gray dark:prose-invert prose-lg max-w-none prose-headings:font-semibold prose-a:text-black dark:prose-a:text-white hover:prose-a:text-gray-600 dark:hover:prose-a:text-gray-300"
          dangerouslySetInnerHTML={{ __html: dummyPost.content }}
        />
      </article>
    </main>
  );
}
