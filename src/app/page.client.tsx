"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  BrainCircuit,
  Users,
  ArrowRight,
  FileText,
  FolderOpen,
  Share2,
  Download,
  Shield,
  BarChart3,
  MessageSquare,
  Sparkles,
  Key,
  Mail,
  Layers,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import dynamic from "next/dynamic";

const WorkspaceShowcase = dynamic(() => import("@/components/home/workspace-showcase").then(mod => mod.WorkspaceShowcase), { ssr: false });

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const coreFeatures = [
    {
      icon: <Search className="w-5 h-5 text-gray-700 dark:text-gray-50" />,
      title: "Semantic Search",
      description: "Find meaning across millions of tokens, powered by advanced vector embeddings and cross-encoder re-ranking.",
    },
    {
      icon: <BrainCircuit className="w-5 h-5 text-gray-700 dark:text-gray-50" />,
      title: "Citation-Backed AI",
      description: "Receive verifiable answers with pinpoint source citations and confidence scores. Powered by Gemini or GPT-4o.",
    },
    {
      icon: <Users className="w-5 h-5 text-gray-700 dark:text-gray-50" />,
      title: "Team Workspaces",
      description: "Collaborate seamlessly. Invite members, assign Owner/Admin/Member roles, and share knowledge bases securely.",
    },
  ];

  const allFeatures = [
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Multi-Format Upload",
      description: "Upload PDFs, DOCX, PPTX, TXT, Markdown, CSV, and JSON with real-time progress tracking.",
    },
    {
      icon: <FolderOpen className="w-5 h-5" />,
      title: "Folder Organization",
      description: "Organize documents in nested folders within workspaces. Navigate with breadcrumb navigation.",
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: "Auto Summaries",
      description: "AI-generated document summaries and suggested starter questions upon upload completion.",
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "RAG Chat",
      description: "Chat with your documents using retrieval-augmented generation with streaming responses.",
    },
    {
      icon: <Download className="w-5 h-5" />,
      title: "Chat Export",
      description: "Export conversations as beautiful Markdown files or professional PDF documents.",
    },
    {
      icon: <Share2 className="w-5 h-5" />,
      title: "Shared Links",
      description: "Generate secure, expiring links to share documents and conversations with anyone.",
    },
    {
      icon: <Layers className="w-5 h-5" />,
      title: "Knowledge Bases",
      description: "Group documents into Knowledge Bases for scoped retrieval and team-focused conversations.",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Security & RBAC",
      description: "Role-based access control with Owner, Admin, and Member roles. Isolated workspace data silos.",
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Analytics Dashboard",
      description: "Track documents, query volume, storage usage, and active users with interactive charts.",
    },
    {
      icon: <Key className="w-5 h-5" />,
      title: "Bring Your Own Key",
      description: "Use your own OpenAI or Gemini API key, or use the free system default for instant access.",
    },
    {
      icon: <Mail className="w-5 h-5" />,
      title: "Email Invitations",
      description: "Send beautifully designed email invitations for workspace onboarding via SMTP.",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Real-Time Processing",
      description: "Async document pipeline with live status updates — from upload to indexed in seconds.",
    },
  ];

  const logos = ["OpenAI", "Vercel", "Stripe", "Linear", "Anthropic"];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-[#FAFAFA] font-sans selection:bg-black/10 dark:selection:bg-white/20 overflow-x-hidden relative transition-colors duration-500">

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* Soft Radial Glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-black/[0.03] dark:bg-white/[0.03] rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Top Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 border-b border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-[#050505]/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-black/5 dark:bg-white/10 flex items-center justify-center border border-black/10 dark:border-white/10">
              <BrainCircuit className="w-3.5 h-3.5 text-black dark:text-white" />
            </div>
            <span className="text-sm font-medium tracking-wide">IntelliDoc</span>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/login" className="text-gray-500 hover:text-gray-900 dark:text-gray-50 dark:hover:text-white transition-colors hidden sm:block">
              Sign In
            </Link>
            <Button asChild variant="secondary" size="sm" className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-full px-4 h-8 text-xs font-medium cursor-pointer">
              <Link href="/register">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-48 pb-32 flex flex-col items-center justify-center text-center">

        <section className="flex flex-col items-center justify-center w-full">

        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-gray-700 dark:bg-white/5 dark:border-white/10 dark:text-gray-50 text-xs font-medium mb-8 shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.03)] cursor-default animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="w-1.5 h-1.5 rounded-full bg-black/80 dark:bg-white/80 animate-pulse" />
          IntelliDoc AI 2.0 is live
        </div>

        {/* Headline - LCP Element */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] text-gray-900 dark:text-white max-w-4xl animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both delay-100">
          The most modern AI-powered document intelligence platform.
        </h1>

        {/* Subheadline */}
        <p className="mt-8 text-lg sm:text-xl text-gray-500 dark:text-gray-50 max-w-2xl leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both delay-200">
          An enterprise-grade AI document intelligence platform that combines semantic search, citation-backed AI chat, and secure team workspaces to transform how you interact with your data.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 fill-mode-both delay-300">
          <Button asChild size="lg" className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-full px-8 h-12 text-sm font-medium shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)] cursor-pointer">
            <Link href="/login">
              Get Started
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="bg-transparent border-black/10 hover:bg-black/5 text-gray-900 dark:border-white/10 dark:hover:bg-white/5 dark:text-white rounded-full px-8 h-12 text-sm font-medium cursor-pointer">
            <Link href="/dashboard">
              View Dashboard <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>

        </section>

        {/* Trust Logos */}
        <section
          className="mt-24 pt-10 border-t border-black/5 dark:border-white/5 w-full max-w-2xl animate-in fade-in duration-1000 delay-500"
        >
          <h2 className="sr-only">Trusted Companies</h2>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-50 uppercase tracking-widest mb-6">Trusted by exceptional teams</p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
            {logos.map((logo, idx) => (
              <span key={idx} className="text-xl font-bold font-heading text-gray-300 dark:text-gray-50 select-none">{logo}</span>
            ))}
          </div>
        </section>

        {/* Core Feature Cards */}
        <section className="mt-32 w-full max-w-6xl text-left">
          <h2 className="sr-only">Core Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {coreFeatures.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="group bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-2xl p-8 hover:bg-gray-50 hover:border-black/10 dark:hover:bg-white/[0.04] dark:hover:border-white/10 transition-all duration-500 ease-out hover:-translate-y-1 shadow-md shadow-black/5 dark:shadow-lg dark:shadow-black/50 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-50 border border-black/5 dark:bg-white/5 dark:border-white/10 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-500">
                {card.icon}
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{card.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-50 leading-relaxed">
                {card.description}
              </p>
            </motion.div>
          ))}
        </div>
        </section>

        {/* WORKSPACE SHOWCASE */}
        <section className="w-full">
          <WorkspaceShowcase />
        </section>

        {/* Full Feature Grid */}
        <section className="mt-40 w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Enterprise Document Intelligence Features.
            </h2>
            <p className="text-gray-500 dark:text-gray-50 max-w-2xl mx-auto">
              From multi-format document upload to AI-powered insights, IntelliDoc brings together every tool your team needs for intelligent document management.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
            {allFeatures.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="group flex gap-4 p-5 rounded-xl bg-white/50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:bg-gray-50 hover:border-black/10 dark:hover:bg-white/[0.04] dark:hover:border-white/10 transition-all duration-300 cursor-default"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0 text-gray-600 dark:text-gray-50 group-hover:scale-105 transition-transform duration-300">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-50 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="mt-40 w-full max-w-3xl text-center animate-in fade-in slide-in-from-bottom-10 duration-1000"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
            Ready to Deploy AI Document Intelligence?
          </h2>
          <p className="text-gray-500 dark:text-gray-50 max-w-xl mx-auto mb-10">
            Start for free with a Gemini API key — no credit card required. Upload your first document in under 30 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-full px-10 h-12 text-sm font-medium shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)] cursor-pointer">
              <Link href="/register">
                Get Started Free <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="bg-transparent border-black/10 hover:bg-black/5 text-gray-900 dark:border-white/10 dark:hover:bg-white/5 dark:text-white rounded-full px-8 h-12 text-sm font-medium cursor-pointer">
              <Link href="/contact">
                Contact Us
              </Link>
            </Button>
          </div>
        </section>

      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-black/5 dark:border-white/5 py-8 text-center text-xs text-gray-400 dark:text-gray-50">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span suppressHydrationWarning>© {new Date().getFullYear()} IntelliDoc AI. All rights reserved.</span>
          <div className="flex flex-wrap justify-center items-center gap-6">
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white/60 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white/60 transition-colors">Terms</Link> 
            <Link href="https://github.com/nitingupta95/intellidoc" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 dark:hover:text-white/60 transition-colors">GitHub</Link>
            <Link href="/contact" className="hover:text-gray-900 dark:hover:text-white/60 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
