import React, { useState } from 'react';
import { Search, ShieldAlert, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebSearchConfirmCardProps {
  pendingId: string;
  verdict: string;
  reason: string;
  goodDocsCount: number;
  answerability?: string;  // Phase 3: "INSUFFICIENT" | "AMBIGUOUS" | undefined
  onResolve: (pendingId: string, consent: boolean) => void;
  resolved?: boolean;
}

/**
 * WebSearchConfirmCard
 *
 * Shown ONLY when the CRAG evaluator judges the retrieved chunks as INSUFFICIENT
 * to answer the query (answerability = INSUFFICIENT). This means the document
 * genuinely does not contain the required information.
 *
 * This card is NOT shown for SYNTHESIZABLE queries — those get a best-effort
 * answer with the SynthesisBadge instead.
 */
export function WebSearchConfirmCard({
  pendingId,
  verdict,
  reason,
  goodDocsCount,
  answerability,
  onResolve,
  resolved,
}: WebSearchConfirmCardProps) {
  const [loading, setLoading] = useState<boolean | null>(null);

  if (resolved) return null;

  return (
    <div className="mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 text-sm flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-500 mt-0.5">
          <ShieldAlert size={16} />
        </div>
        <div>
          <h4 className="font-semibold text-amber-700 dark:text-amber-500 flex items-center gap-2">
            Not Enough Context in Your Documents
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-sm bg-amber-500/20 font-bold">
              {verdict}
            </span>
          </h4>
          <p className="opacity-80 mt-1 leading-relaxed">
            {reason}
          </p>
          <p className="opacity-70 text-xs mt-2">
            Found {goodDocsCount} related snippet{goodDocsCount !== 1 ? 's' : ''} in your documents,
            but they don&apos;t contain enough information to answer this specific question.
            A web search may help.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-2 ml-11">
        <Button
          size="sm"
          className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={() => { setLoading(true); onResolve(pendingId, true); }}
          disabled={loading !== null}
        >
          {loading === true ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search Web
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-amber-500/30 hover:bg-amber-500/20 text-amber-700 dark:text-amber-500"
          onClick={() => { setLoading(false); onResolve(pendingId, false); }}
          disabled={loading !== null}
        >
          {loading === false ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
          Answer Conservatively
        </Button>
      </div>
    </div>
  );
}
