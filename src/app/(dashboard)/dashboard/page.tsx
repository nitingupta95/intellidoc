import { 
  FileText, 
  MessageSquare, 
  Zap, 
  Clock,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { getDashboardData } from "@/lib/dashboard-data";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityRow } from "@/components/dashboard/activity-row";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const {
    totalDocuments,
    aiQueries,
    avgConfidence,
    timeSavedHours,
    activity,
    insights,
  } = await getDashboardData(userId);

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto overflow-x-hidden pb-6">
      {/* TOP BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your intelligent document workspace.</p>
        </div>
        <Link href="/documents">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
            <FileText size={18} />
            Upload Document
          </button>
        </Link>
      </div>

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Documents" 
          value={totalDocuments.toString()} 
          change="+0%" 
          icon={<FileText size={18} className="text-blue-500 dark:text-blue-400" />} 
          iconBg="bg-blue-500/10"
        />
        <StatCard 
          title="AI Queries" 
          value={aiQueries.toString()} 
          change="+0%" 
          icon={<MessageSquare size={18} className="text-purple-500 dark:text-purple-400" />} 
          iconBg="bg-purple-500/10"
        />
        <StatCard 
          title="Avg Confidence" 
          value={avgConfidence > 0 ? `${avgConfidence.toFixed(1)}%` : "N/A"} 
          change="+0%" 
          icon={<Zap size={18} className="text-amber-500 dark:text-amber-400" />} 
          iconBg="bg-amber-500/10"
        />
        <StatCard 
          title="Time Saved" 
          value={`${timeSavedHours} hrs`} 
          change="+0%" 
          icon={<Clock size={18} className="text-teal-500 dark:text-teal-400" />} 
          iconBg="bg-teal-500/10"
        />
      </div>

      {/* LOWER SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        
        {/* LEFT — Recent Knowledge Activity */}
        <div className="glass-panel p-5 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-heading font-semibold text-foreground">Recent Knowledge Activity</h2>
            <Link href="/documents" className="text-sm text-muted-foreground hover:text-foreground transition-colors">View All</Link>
          </div>
          
          <div className="flex flex-col">
            {activity.length > 0 ? (
              activity.map((act, idx) => (
                <ActivityRow 
                  key={`${act.type}-${act.id}`}
                  icon={
                    act.type === "document" 
                      ? <FileText size={16} className="text-foreground/70" />
                      : <MessageSquare size={16} className="text-foreground/70" />
                  } 
                  title={act.title}
                  meta={`${formatDistanceToNow(act.date, { addSuffix: true })} • By ${session?.user?.name || "You"}`}
                  isLast={idx === activity.length - 1}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-4">No recent activity.</p>
            )}
          </div>
        </div>

        {/* RIGHT — AI Insights */}
        <div className="glass-panel p-5 border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-purple-500 dark:text-purple-400" />
            <h2 className="text-base font-heading font-semibold text-foreground">AI Insights</h2>
          </div>

          <div className="flex flex-col gap-3">
            {insights.map((insight) => (
              <div 
                key={insight.id}
                className={`border rounded-lg p-4 ${
                  insight.color === "purple" 
                    ? "bg-purple-500/5 border-purple-500/10 dark:bg-purple-500/10 dark:border-purple-500/20" 
                    : "bg-emerald-500/5 border-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                }`}
              >
                <h3 className={`text-sm font-medium mb-1 ${
                  insight.color === "purple" ? "text-purple-600 dark:text-purple-400" : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {insight.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {insight.body}
                </p>
                <Link 
                  href={insight.href}
                  className="w-full flex items-center justify-center bg-foreground/5 hover:bg-foreground/10 text-sm text-foreground rounded-md py-2 mt-3 transition-colors"
                >
                  {insight.button}
                </Link>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
