"use client";

import { motion } from "framer-motion";

export function WorkspaceShowcase() {
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
          Secure Team Collaboration for Document Intelligence.
        </h2>
        <p className="text-gray-500 dark:text-gray-50 max-w-2xl mx-auto">
          IntelliDoc allows you to create isolated workspaces, invite team members, and manage shared document knowledge bases securely.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-[400px] md:h-[500px] rounded-3xl bg-gray-50/50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 overflow-hidden shadow-inner flex items-center justify-center"
      >
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px]" />

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
