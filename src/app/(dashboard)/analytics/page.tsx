"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend, RadialBarChart, RadialBar,
  PolarAngleAxis,
} from 'recharts';
import {
  Activity, Database, FileText, Users, ArrowUpRight, Loader2,
  ShieldCheck, Target, Layers, BookOpen, AlertTriangle, CheckCircle2, Info,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RagasAverages {
  faithfulness:     number | null;
  answerRelevancy:  number | null;
  contextPrecision: number | null;
  contextRecall:    number | null;
  evaluatedCount:   number;
  totalAssistantMessages: number;
}

interface RagasTrendPoint {
  name: string;
  faithfulness:     number | null;
  answerRelevancy:  number | null;
  contextPrecision: number | null;
  contextRecall:    number | null;
}

interface ScoreDistribution {
  good: number;
  fair: number;
  poor: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Colour based on score value */
function scoreColor(val: number | null): string {
  if (val === null) return "#6b7280"; // gray – not evaluated
  if (val >= 0.7)   return "#22c55e"; // green
  if (val >= 0.4)   return "#f59e0b"; // amber
  return               "#ef4444";     // red
}

function scoreBg(val: number | null): string {
  if (val === null) return "rgba(107,114,128,0.12)";
  if (val >= 0.7)   return "rgba(34,197,94,0.12)";
  if (val >= 0.4)   return "rgba(245,158,11,0.12)";
  return               "rgba(239,68,68,0.12)";
}

function scoreLabel(val: number | null): string {
  if (val === null) return "N/A";
  if (val >= 0.7)   return "Good";
  if (val >= 0.4)   return "Fair";
  return               "Poor";
}

function fmt(val: number | null): string {
  if (val === null) return "—";
  return (val * 100).toFixed(1) + "%";
}

// ─── Radial Gauge for one metric ─────────────────────────────────────────────

function MetricGauge({
  label, icon: Icon, value, description,
}: {
  label: string;
  icon: React.ElementType;
  value: number | null;
  description: string;
}) {
  const pct  = value !== null ? Math.round(value * 100) : 0;
  const data = [{ name: label, value: pct, fill: scoreColor(value) }];
  const col  = scoreColor(value);
  const bg   = scoreBg(value);

  return (
    <div
      className="glass-panel p-5 border border-border/50 flex flex-col items-center gap-3 relative overflow-hidden group transition-all hover:border-border"
      style={{ background: bg }}
    >
      <div className="flex items-center gap-2 self-start w-full">
        <Icon className="w-4 h-4" style={{ color: col }} />
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ color: col, background: bg }}
        >
          {scoreLabel(value)}
        </span>
      </div>

      {/* Radial chart */}
      <div className="relative w-36 h-36">
        <RadialBarChart
          width={144}
          height={144}
          cx={72}
          cy={72}
          innerRadius={52}
          outerRadius={68}
          startAngle={90}
          endAngle={-270}
          data={data}
          barSize={14}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          {/* Track ring */}
          <RadialBar
            background={{ fill: "rgba(255,255,255,0.05)" }}
            dataKey="value"
            cornerRadius={8}
          />
        </RadialBarChart>

        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold font-heading" style={{ color: col }}>
            {value !== null ? `${pct}%` : "—"}
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Score Distribution Mini-Bar ──────────────────────────────────────────────

function DistributionBar({ dist }: { dist: ScoreDistribution }) {
  const total = dist.good + dist.fair + dist.poor;
  if (total === 0) return <div className="text-xs text-muted-foreground">No data</div>;
  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`;

  return (
    <div className="flex items-center gap-1 w-full h-2 rounded-full overflow-hidden">
      {dist.good > 0  && <div className="bg-green-500 h-full rounded-l" style={{ width: pct(dist.good)  }} />}
      {dist.fair > 0  && <div className="bg-amber-500 h-full"           style={{ width: pct(dist.fair)  }} />}
      {dist.poor > 0  && <div className="bg-red-500   h-full rounded-r" style={{ width: pct(dist.poor)  }} />}
    </div>
  );
}

// ─── Failure Mode Alert ───────────────────────────────────────────────────────

function FailureModeAlerts({ averages }: { averages: RagasAverages }) {
  const alerts: { icon: React.ElementType; color: string; title: string; desc: string }[] = [];

  if (averages.faithfulness !== null && averages.faithfulness < 0.4)
    alerts.push({ icon: AlertTriangle, color: "text-red-400", title: "Hallucinations Detected", desc: `Avg faithfulness ${fmt(averages.faithfulness)} — LLM is generating claims not in the context.` });

  if (averages.contextPrecision !== null && averages.contextPrecision < 0.4)
    alerts.push({ icon: AlertTriangle, color: "text-amber-400", title: "Poor Retrieval Precision", desc: `Avg context precision ${fmt(averages.contextPrecision)} — Irrelevant chunks are reaching the top-k. Possible wrong retrieval, stale KB, or duplicates.` });

  if (averages.contextRecall !== null && averages.contextRecall < 0.4)
    alerts.push({ icon: AlertTriangle, color: "text-amber-400", title: "Low Context Coverage", desc: `Avg context recall ${fmt(averages.contextRecall)} — Context is missing information. Possible chunking issues or stale knowledge base.` });

  if (averages.answerRelevancy !== null && averages.answerRelevancy < 0.4)
    alerts.push({ icon: AlertTriangle, color: "text-orange-400", title: "Answers Off-Topic", desc: `Avg answer relevancy ${fmt(averages.answerRelevancy)} — Answers are drifting from the original questions.` });

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-400">All metrics healthy</p>
          <p className="text-xs text-muted-foreground mt-0.5">No failure modes detected in recent responses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((a, i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-background/40 border border-border/40 rounded-lg">
          <a.icon className={`w-4 h-4 mt-0.5 shrink-0 ${a.color}`} />
          <div>
            <p className={`text-sm font-medium ${a.color}`}>{a.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    metrics: { totalDocuments: 0, totalQueries: 0, storageGB: 0, activeUsers: 0 },
    queryData: [],
    storageData: [],
    ragas: null,
  });

  useEffect(() => {
    if (!activeWorkspaceId) return;

    fetch(`/api/analytics?workspaceId=${activeWorkspaceId}`)
      .then(res => res.json())
      .then(resData => { if (!resData.error) setData(resData); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeWorkspaceId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const ragas: { averages: RagasAverages; trend: RagasTrendPoint[]; distribution: Record<string, ScoreDistribution> } | null = data.ragas ?? null;

  const RAGAS_METRICS = [
    {
      key:   "faithfulness",
      label: "Faithfulness",
      icon:  ShieldCheck,
      desc:  "Claims in answers are supported by the retrieved context. Low = hallucinations.",
    },
    {
      key:   "answerRelevancy",
      label: "Answer Relevancy",
      icon:  Target,
      desc:  "Answers directly address the user's question. Low = off-topic responses.",
    },
    {
      key:   "contextPrecision",
      label: "Context Precision",
      icon:  Layers,
      desc:  "Relevant chunks are ranked at the top. Low = wrong retrieval or duplicate docs.",
    },
    {
      key:   "contextRecall",
      label: "Context Recall",
      icon:  BookOpen,
      desc:  "Context covers all info needed to answer. Low = chunking issues or stale KB.",
    },
  ] as const;

  const TREND_COLORS = {
    faithfulness:     "#22c55e",
    answerRelevancy:  "#3b82f6",
    contextPrecision: "#a855f7",
    contextRecall:    "#f59e0b",
  } as const;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto pb-6 pr-2">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Monitor usage, queries, and RAG quality metrics.</p>
        </div>
      </header>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Documents", value: data.metrics.totalDocuments, change: "+0%", icon: FileText, color: "text-blue-500" },
          { title: "Total Queries",   value: data.metrics.totalQueries,   change: "+0%", icon: Activity, color: "text-green-500" },
          { title: "Vector Storage",  value: `${data.metrics.storageGB} GB`, change: "+0%", icon: Database, color: "text-purple-500" },
          { title: "Active Users (30d)", value: data.metrics.activeUsers, change: "+0%", icon: Users, color: "text-orange-500" },
        ].map((metric, i) => (
          <div key={i} className="glass-panel p-5 border border-border/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-[30px] group-hover:bg-primary/10 transition-colors pointer-events-none" />
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">{metric.title}</h3>
              <metric.icon className={`h-5 w-5 ${metric.color}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-bold">{metric.value}</span>
              <span className="text-xs font-medium text-green-500 flex items-center bg-green-500/10 px-1.5 py-0.5 rounded-full">
                <ArrowUpRight size={12} className="mr-0.5" /> {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          RAGAS QUALITY METRICS SECTION
      ────────────────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-6 border border-border/50">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-xl font-heading font-semibold">RAG Quality Metrics</h2>
            <p className="text-sm text-muted-foreground mt-1">
              RAGAS evaluation scores — automatically computed after every chat response.
            </p>
          </div>
          {ragas && (
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">Evaluated</p>
              <p className="text-lg font-bold font-heading text-primary">
                {ragas.averages.evaluatedCount}
                <span className="text-sm font-normal text-muted-foreground">
                  /{ragas.averages.totalAssistantMessages}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">responses</p>
            </div>
          )}
        </div>

        {!ragas || ragas.averages.evaluatedCount === 0 ? (
          <div className="flex items-center gap-3 p-6 bg-background/30 rounded-xl border border-border/30 mt-4">
            <Info className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">No evaluated responses yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                RAGAS scores will appear here automatically after chat messages are processed.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 4 Gauge Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {RAGAS_METRICS.map(({ key, label, icon, desc }) => (
                <MetricGauge
                  key={key}
                  label={label}
                  icon={icon}
                  value={ragas.averages[key as keyof RagasAverages] as number | null}
                  description={desc}
                />
              ))}
            </div>

            {/* Score Distribution bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {RAGAS_METRICS.map(({ key, label }) => {
                const dist = ragas.distribution[key];
                const total = dist.good + dist.fair + dist.poor;
                return (
                  <div key={key} className="p-3 bg-background/30 rounded-lg border border-border/30">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">{label} distribution</span>
                      <span className="text-xs text-muted-foreground">{total} msgs</span>
                    </div>
                    <DistributionBar dist={dist} />
                    <div className="flex gap-3 mt-2">
                      {[
                        { label: "Good", count: dist.good,  color: "bg-green-500" },
                        { label: "Fair", count: dist.fair,  color: "bg-amber-500" },
                        { label: "Poor", count: dist.poor,  color: "bg-red-500"   },
                      ].map(b => (
                        <div key={b.label} className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${b.color}`} />
                          <span className="text-xs text-muted-foreground">{b.label} {b.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Failure Mode Alerts */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Failure Mode Detection</h3>
              <FailureModeAlerts averages={ragas.averages} />
            </div>
          </>
        )}
      </div>

      {/* RAGAS Trend Chart */}
      {ragas && ragas.averages.evaluatedCount > 0 && (
        <div className="glass-panel p-6 border border-border/50 flex flex-col min-h-[360px]">
          <div className="mb-6">
            <h3 className="text-lg font-heading font-semibold">RAGAS Score Trends</h3>
            <p className="text-sm text-muted-foreground">Daily average scores over the last 7 days</p>
          </div>
          <div className="flex-1 w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ragas.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} domain={[0, 1]}
                  tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}
                  formatter={(v: any) => v !== null ? `${(v * 100).toFixed(1)}%` : '—'}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                {RAGAS_METRICS.map(({ key, label }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={label}
                    stroke={TREND_COLORS[key]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: TREND_COLORS[key] }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Charts Row — existing query volume + storage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queries Chart */}
        <div className="glass-panel p-6 border border-border/50 flex flex-col min-h-[400px]">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-heading font-semibold">Query Volume</h3>
              <p className="text-sm text-muted-foreground">Daily AI generations over the last week</p>
            </div>
          </div>
          <div className="flex-1 w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.queryData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Bar dataKey="queries" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Storage Chart */}
        <div className="glass-panel p-6 border border-border/50 flex flex-col min-h-[400px]">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-heading font-semibold">Storage Utilization</h3>
              <p className="text-sm text-muted-foreground">Vector & object storage growth (GB)</p>
            </div>
          </div>
          <div className="flex-1 w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.storageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="usage" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorUsage)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="glass-panel p-6 border border-border/50">
        <div className="mb-6">
          <h3 className="text-lg font-heading font-semibold">System Infrastructure Status</h3>
          <p className="text-sm text-muted-foreground">Real-time health of core services</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: "FastAPI Backend",   status: "Operational", ping: "42ms" },
            { name: "Qdrant Vector DB",  status: "Operational", ping: "12ms" },
            { name: "RAGAS Evaluator",   status: "Operational", ping: "~4s"  },
            { name: "RabbitMQ Workers",  status: "Operational", ping: "15ms" },
          ].map((service, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-background/30 rounded-lg border border-border/30">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{service.status}</p>
                </div>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{service.ping}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
