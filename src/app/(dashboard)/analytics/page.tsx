"use client";

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Activity, Database, FileText, Users, ArrowUpRight } from "lucide-react";

const queryData = [
  { name: 'Mon', queries: 400 },
  { name: 'Tue', queries: 300 },
  { name: 'Wed', queries: 550 },
  { name: 'Thu', queries: 480 },
  { name: 'Fri', queries: 700 },
  { name: 'Sat', queries: 200 },
  { name: 'Sun', queries: 150 },
];

const storageData = [
  { name: 'Jan', usage: 10 },
  { name: 'Feb', usage: 15 },
  { name: 'Mar', usage: 28 },
  { name: 'Apr', usage: 45 },
  { name: 'May', usage: 60 },
  { name: 'Jun', usage: 85 },
];

export default function AnalyticsPage() {
  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto pb-6 pr-2">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Monitor usage, queries, and system performance.</p>
        </div>
      </header>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Documents", value: "1,248", change: "+12%", icon: FileText, color: "text-blue-500" },
          { title: "AI Queries (30d)", value: "48.2k", change: "+24%", icon: Activity, color: "text-green-500" },
          { title: "Vector Storage", value: "24.5 GB", change: "+5%", icon: Database, color: "text-purple-500" },
          { title: "Active Users", value: "142", change: "+18%", icon: Users, color: "text-orange-500" },
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

      {/* Charts Row */}
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
              <BarChart data={queryData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
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
              <AreaChart data={storageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
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
            { name: "FastAPI Backend", status: "Operational", ping: "42ms" },
            { name: "Qdrant Vector DB", status: "Operational", ping: "12ms" },
            { name: "Neo4j Graph DB", status: "Operational", ping: "28ms" },
            { name: "RabbitMQ Workers", status: "Operational", ping: "15ms" },
          ].map((service, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-background/30 rounded-lg border border-border/30">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
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
