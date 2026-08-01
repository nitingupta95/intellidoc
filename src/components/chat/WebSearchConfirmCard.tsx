import React, { useState } from 'react';
import { Search, ShieldAlert, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebSearchConfirmCardProps {
  pendingId: string;
  verdict: string;
  reason: string;
  goodDocsCount: number;
  onResolve: (pendingId: string, consent: boolean) => void;
  resolved?: boolean;
}

export function WebSearchConfirmCard({
  pendingId,
  verdict,
  reason,
  goodDocsCount,
  onResolve,
  resolved
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
            Incomplete Knowledge
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-sm bg-amber-500/20 font-bold">
              {verdict}
            </span>
          </h4>
          <p className="opacity-80 mt-1 leading-relaxed">
            {reason}
          </p>
          <p className="opacity-70 text-xs mt-2">
            Found {goodDocsCount} relevant snippets in your documents.
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
