import React from "react";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  iconBg: string;
}

export function StatCard({ title, value, change, icon, iconBg }: StatCardProps) {
  return (
    <div className="glass-panel p-5 border border-border/50 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm text-muted-foreground">{title}</h3>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl md:text-3xl font-bold text-foreground">{value}</span>
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          {change}
        </span>
      </div>
    </div>
  );
}
