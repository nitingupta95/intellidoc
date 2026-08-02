import React from 'react';
import { Sparkles } from 'lucide-react';

interface SynthesisBadgeProps {
  reason?: string;
}
 
export function SynthesisBadge({ reason }: SynthesisBadgeProps) {
  return (
    <div className="mt-3 flex items-center gap-2 text-[11px] text-indigo-600 dark:text-indigo-400 opacity-80">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20">
        <Sparkles size={11} className="shrink-0" />
        <span className="font-medium">
          {reason ?? 'Synthesized from your document — answer combines multiple sections'}
        </span>
      </div>
    </div>
  );
}
