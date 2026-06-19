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

function WorkspaceShowcase() {
  const nodes = [
    { id: 'center', label: 'Workspace: Acme Corp', x: '50%', y: '50%', type: 'primary', delay: 0 },
    { id: 'member1', label: 'Alice (Owner)', x: '20%', y: '30%', type: 'secondary', delay: 0.2 },
    { id: 'member2', label: 'Bob (Admin)', x: '80%', y: '25%', type: 'secondary', delay: 0.4 },
    { id: 'kb1', label: 'KB: Engineering Docs', x: '75%', y: '75%', type: 'secondary', delay: 0.6 },
    { id: 'kb2', label: 'KB: HR Policies', x: '25%', y: '70%', type: 'secondary', delay: 0.8 },
    { id: 'doc', label: 'Document: Q3 Roadmap', x: '85%', y: '50%', type: 'alert', delay: 1 },
  ];

  const lines = [
    { x1: '50%', y1: '50%', x2: '20%', y2: '30%' },
    { x1: '50%', y1: '50%', x2: '80%', y2: '25%' },
    { x1: '50%', y1: '50%', x2: '75%', y2: '75%' },
    { x1: '50%', y1: '50%', x2: '25%', y2: '70%' },
    { x1: '50%', y1: '50%', x2: '85%', y2: '50%' },
    { x1: '80%', y1: '25%', x2: '85%', y2: '50%' },
    { x1: '25%', y1: '70%', x2: '20%', y2: '30%' },
  ];

  return (
    <div className="mt-40 w-full max-w-5xl mx-auto flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
          Collaboration, Simplified.
        </h2>
        <p className="text-gray-500 dark:text-gray-50 max-w-2xl mx-auto">
          IntelliDoc allows you to create isolated workspaces, invite team members, and manage shared knowledge bases securely.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-[400px] md:h-[500px] rounded-3xl bg-gray-50/50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 overflow-hidden shadow-inner flex items-center justify-center"
      >
        {/* Background Grid inside showcase */}
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px]" />

        {/* Lines */}
        <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none">
          {lines.map((line, i) => (
            <motion.line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="currentColor"
              className="text-black/10 dark:text-white/10"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: i * 0.1 }}
            />
          ))}
          {/* Animated glowing dots traveling along paths */}
          {lines.slice(0, 4).map((line, i) => (
            <motion.circle
              key={`dot-${i}`}
              r="2"
              fill="currentColor"
              className="text-black/30 dark:text-white/30"
              animate={{
                cx: [line.x1, line.x2],
                cy: [line.y1, line.y2],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.5
              }}
            />
          ))}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            className="absolute z-20"
            style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: node.delay }}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: node.delay }}
                className={`px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium backdrop-blur-md border shadow-lg whitespace-nowrap transition-colors hover:border-black/30 dark:hover:border-white/30 cursor-pointer ${node.type === 'primary'
                    ? 'bg-black text-white border-black/20 dark:bg-white dark:text-black dark:border-white/20 shadow-black/20 dark:shadow-white/20'
                    : node.type === 'alert'
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50'
                      : 'bg-white/80 dark:bg-[#050505]/80 text-gray-700 dark:text-gray-50 border-black/10 dark:border-white/10'
                  }`}
              >
                {node.label}
              </motion.div>
            </motion.div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

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

        {/* Status Pill */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-gray-700 dark:bg-white/5 dark:border-white/10 dark:text-gray-50 text-xs font-medium mb-8 shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.03)] cursor-default"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-black/80 dark:bg-white/80 animate-pulse" />
          IntelliDoc AI 2.0 is live
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] text-gray-900 dark:text-white max-w-4xl"
        >
          The most modern AI-powered document intelligence platform.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-lg sm:text-xl text-gray-500 dark:text-gray-50 max-w-2xl leading-relaxed"
        >
          Upload documents, semantic search, AI chat with citations, auto-generated summaries, shared links, folder organization, and team workspaces. All in one quiet, confident platform.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-10"
        >
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
        </motion.div>

        {/* Trust Logos */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-24 pt-10 border-t border-black/5 dark:border-white/5 w-full max-w-2xl"
        >
          <p className="text-xs font-medium text-gray-400 dark:text-gray-50 uppercase tracking-widest mb-6">Trusted by exceptional teams</p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
            {logos.map((logo, idx) => (
              <span key={idx} className="text-xl font-bold font-heading text-gray-300 dark:text-gray-50 select-none">{logo}</span>
            ))}
          </div>
        </motion.div>

        {/* Core Feature Cards */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl text-left">
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

        {/* WORKSPACE SHOWCASE */}
        <WorkspaceShowcase />

        {/* Full Feature Grid */}
        <div className="mt-40 w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
              Everything You Need, Built In.
            </h2>
            <p className="text-gray-500 dark:text-gray-50 max-w-2xl mx-auto">
              From document upload to AI-powered insights, IntelliDoc brings together every tool your team needs for intelligent document management.
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
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-40 w-full max-w-3xl text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
            Ready to Transform Your Documents?
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
        </motion.div>

      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-black/5 dark:border-white/5 py-8 text-center text-xs text-gray-400 dark:text-gray-50">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>© {new Date().getFullYear()} IntelliDoc AI. All rights reserved.</span>
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
