"use client";

import { motion, MotionConfig } from "framer-motion";
import { BrainCircuit, FileText, Info, Sparkles } from "lucide-react";

// Static mock of the real chat UI (components/chat/chat-messages.tsx) showing a
// cross-document, citation-backed answer — the product's core loop.
const sources = [
  { name: "Architecture-Overview.pdf", match: "91.8" },
  { name: "Aurora-SLA.pdf", match: "88.2" },
];

const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const },
});

function Cite({ children }: { children: string }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-primary/15 bg-primary/5 px-1.5 py-0.5 align-middle text-xs font-medium text-primary">
      <FileText className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}

export function HeroPreview() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        {...reveal(0.4)}
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card text-left shadow-xl shadow-black/5"
        role="img"
        aria-label="IntelliDoc chat answering a question with citations from two documents"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          <span className="ml-3 text-xs text-muted-foreground">Knowledge base · Engineering Docs</span>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {/* User question */}
          <motion.div {...reveal(0.7)} className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              What&apos;s the failover time for the database our architecture uses?
            </p>
          </motion.div>

          {/* Assistant answer */}
          <motion.div {...reveal(1.1)} className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20">
              <BrainCircuit className="h-3.5 w-3.5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed text-foreground">
              <p>
                Your architecture runs on <strong>Amazon Aurora PostgreSQL</strong>
                <Cite>Architecture-Overview.pdf</Cite>. For Multi-AZ deployments, read-replica failover
                completes in <strong>under 5 seconds</strong>
                <Cite>Aurora-SLA.pdf</Cite>.
              </p>

              <motion.div {...reveal(1.6)} className="border-t border-border pt-3">
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Info className="h-3 w-3" aria-hidden /> Sources
                </p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <span key={s.name} className="rounded-lg border border-border px-2.5 py-1 text-xs">
                      <span className="font-semibold text-primary">{s.name}</span>
                      <span className="text-muted-foreground"> · {s.match}% match</span>
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.p {...reveal(1.9)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" aria-hidden />
                Synthesized across 2 documents in 2 retrieval hops
              </motion.p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </MotionConfig>
  );
}
