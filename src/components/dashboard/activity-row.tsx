import React from "react";

interface ActivityRowProps {
  icon: React.ReactNode;
  title: string;
  meta: string;
  isLast?: boolean;
}

export function ActivityRow({ icon, title, meta, isLast = false }: ActivityRowProps) {
  return (
    <div className={`flex items-center gap-3 py-3 ${!isLast ? 'border-b border-border/50' : ''}`}>
      <div className="w-9 h-9 bg-foreground/5 rounded-full flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>
      </div>
    </div>
  );
}
