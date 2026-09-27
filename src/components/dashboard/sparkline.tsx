"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

interface SparklineProps {
  data: number[];
  label: string;
}

export function Sparkline({ data, label }: SparklineProps) {
  const points = data.map((v, i) => ({ day: data.length - 1 - i, v }));
  const total = data.reduce((a, b) => a + b, 0);

  return (
    <div
      className="h-10 w-full text-purple-500 dark:text-purple-400"
      role="img"
      aria-label={`${label}: ${total} total, ${data[data.length - 1]} today`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Tooltip
            cursor={false}
            formatter={(v) => [v, "queries"]}
            labelFormatter={(_, p) => {
              const day = p?.[0]?.payload?.day;
              return day === 0 ? "Today" : day === 1 ? "Yesterday" : `${day} days ago`;
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, padding: "4px 8px" }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="currentColor"
            strokeWidth={1.5}
            fill="currentColor"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
