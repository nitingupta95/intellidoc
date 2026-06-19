"use client";

interface SuggestionButtonProps {
  text: string;
  onClick: (t: string) => void;
}

export function SuggestionButton({ text, onClick }: SuggestionButtonProps) {
  return (
    <button 
      onClick={() => onClick(text)}
      className="text-left px-4 py-3 rounded-xl border border-border/50 bg-background/30 hover:bg-muted hover:border-primary/30 transition-all text-sm font-medium text-muted-foreground hover:text-foreground w-full h-auto whitespace-normal break-words"
    >
      &quot;{text}&quot;
    </button>
  );
}
