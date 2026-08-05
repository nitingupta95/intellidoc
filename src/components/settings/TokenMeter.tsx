"use client";

import { Progress } from "@/components/ui/progress";

interface TokenMeterProps {
  lifetimeGranted: number;
  lifetimeSpent: number;
}

export function TokenMeter({ lifetimeGranted, lifetimeSpent }: TokenMeterProps) {
  const percentage = lifetimeGranted > 0 
    ? Math.min(100, Math.max(0, (lifetimeSpent / lifetimeGranted) * 100))
    : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span>Lifetime Usage</span>
        <span className="text-muted-foreground">
          {lifetimeSpent.toLocaleString()} / {lifetimeGranted.toLocaleString()} Credits
        </span>
       </div>
    </div>
  );
}
