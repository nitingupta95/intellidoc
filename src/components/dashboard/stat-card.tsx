import React from "react";
import { Sparkline } from "@/components/dashboard/sparkline";

interface StatCardProps {
  title: string;
  value: string;
  /** % change vs the comparison window; null/undefined hides the badge (no history yet) */
  change?: number | null;
  changeLabel?: string;
  /** Optional per-day series rendered as a sparkline under the value */
  trend?: number[];
  trendLabel?: string;
  icon: React.ReactNode;
  iconBg: string;
}

export function StatCard({ title, value, change, changeLabel = "vs 30d ago", trend, trendLabel, icon, iconBg }: StatCardProps) {
  return (
    <div className="glass-panel p-5 border border-border/50 flex flex-col justify-between transition-[border-color,box-shadow] duration-200 ease-out hover:border-border hover:shadow-2xl">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm text-muted-foreground">{title}</h3>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl md:text-3xl font-bold text-foreground">{value}</span>
          {change != null && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${change < 0
                ? "text-red-600 dark:text-red-400 bg-red-500/10"
                : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"}`}
              title={changeLabel}
            >
              {change > 0 ? "+" : ""}{change}%
              <span className="sr-only"> {changeLabel}</span>
            </span>
          )}
        </div>
        {/* Beside the value so numbers stay aligned across cards; hidden when there's no activity to chart */}
        {trend && trend.some((v) => v > 0) && (
          <div className="w-24 sm:w-28 shrink-0">
            <Sparkline data={trend} label={trendLabel ?? title} />
          </div>
        )}
      </div>
    </div>
  );
}
