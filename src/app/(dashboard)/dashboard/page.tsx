import { 
  FileText, 
  MessageSquare, 
  Zap, 
  Clock,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  // 1. Total Documents
  const totalDocuments = await db.document.count({
    where: { userId },
  });

  // 2. AI Queries
  const aiQueries = await db.message.count({
    where: {
      role: "USER",
      conversation: { userId },
    },
  });

  // 3. Avg Confidence
  const assistantMessages = await db.message.findMany({
    where: {
      role: "ASSISTANT",
      conversation: { userId },
      confidence: { not: null },
    },
    select: { confidence: true },
  });
  
  let avgConfidence = 0;
  if (assistantMessages.length > 0) {
    const sum = assistantMessages.reduce((acc, msg) => acc + (msg.confidence || 0), 0);
    avgConfidence = (sum / assistantMessages.length) * 100; // Assuming confidence is 0-1
    // If it's already 0-100, we don't multiply by 100. Let's assume it's 0-1.
  }

  // 4. Time Saved (5 mins per query)
  const timeSavedHours = Math.round((aiQueries * 5) / 60);

  // 5. Recent Knowledge Activity
  const recentDocs = await db.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, filename: true, createdAt: true },
  });

  const recentConvos = await db.conversation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, createdAt: true },
  });

  const activity = [
    ...recentDocs.map(d => ({
      id: d.id,
      type: "document",
      title: `Uploaded '${d.filename}'`,
      date: d.createdAt,
    })),
    ...recentConvos.map(c => ({
      id: c.id,
      type: "conversation",
      title: `Asked about '${c.title}'`,
      date: c.createdAt,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 4);

  // 6. AI Insights (Dynamic based on DB)
  const insights = [];
  
  // Example insight: Recent upload cluster
  if (recentDocs.length > 0) {
    insights.push({
      id: "cluster",
      type: "cluster",
      title: "New Topic Indexed",
      body: `You recently uploaded '${recentDocs[0].filename}'. Our AI is now ready to answer questions about it.`,
      button: "Ask a Question",
      href: "/chat",
      color: "green",
    });
  } else {
    insights.push({
      id: "cluster",
      type: "cluster",
      title: "Workspace Empty",
      body: `Upload your first document to start building your intelligent knowledge base.`,
      button: "Upload Document",
      href: "/documents",
      color: "green",
    });
  }

  // Example insight: Confidence / Gap
  if (avgConfidence > 0 && avgConfidence < 80) {
    insights.push({
      id: "gap",
      type: "gap",
      title: "Knowledge Gap Detected",
      body: `Your recent AI queries have lower confidence. Consider uploading more detailed documents.`,
      button: "Review Queries",
      href: "/chat",
      color: "purple",
    });
  } else {
    insights.push({
      id: "gap",
      type: "gap",
      title: "High Confidence Answers",
      body: `Your knowledge base is well-stocked. The AI is answering with high confidence!`,
      button: "View Analytics",
      href: "/dashboard",
      color: "purple",
    });
  }

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto pb-6">
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

function StatCard({ title, value, change, icon, iconBg }: { title: string, value: string, change: string, icon: React.ReactNode, iconBg: string }) {
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

function ActivityRow({ icon, title, meta, isLast = false }: { icon: React.ReactNode, title: string, meta: string, isLast?: boolean }) {
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
