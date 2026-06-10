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
    <div className="p-10 min-h-full">
      {/* TOP BAR */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Overview of your intelligent document workspace.</p>
        </div>
        <button className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors">
          <FileText size={18} />
          Upload Document
        </button>
      </div>

      {/* STAT CARDS ROW */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        <StatCard 
          title="Total Documents" 
          value={totalDocuments.toString()} 
          change="+0%" 
          icon={<FileText size={18} className="text-blue-400" />} 
          iconBg="bg-blue-400/10"
        />
        <StatCard 
          title="AI Queries" 
          value={aiQueries.toString()} 
          change="+0%" 
          icon={<MessageSquare size={18} className="text-purple-400" />} 
          iconBg="bg-purple-400/10"
        />
        <StatCard 
          title="Avg Confidence" 
          value={avgConfidence > 0 ? `${avgConfidence.toFixed(1)}%` : "N/A"} 
          change="+0%" 
          icon={<Zap size={18} className="text-amber-400" />} 
          iconBg="bg-amber-400/10"
        />
        <StatCard 
          title="Time Saved" 
          value={`${timeSavedHours} hrs`} 
          change="+0%" 
          icon={<Clock size={18} className="text-teal-400" />} 
          iconBg="bg-teal-400/10"
        />
      </div>

      {/* LOWER SECTION */}
      <div className="grid grid-cols-[1fr_340px] gap-4 mt-6">
        
        {/* LEFT — Recent Knowledge Activity */}
        <div className="bg-[#222222] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Recent Knowledge Activity</h2>
            <button className="text-sm text-gray-400 hover:text-white transition-colors">View All</button>
          </div>
          
          <div className="flex flex-col">
            {activity.length > 0 ? (
              activity.map((act, idx) => (
                <ActivityRow 
                  key={`${act.type}-${act.id}`}
                  icon={
                    act.type === "document" 
                      ? <FileText size={16} className="text-white" />
                      : <MessageSquare size={16} className="text-white" />
                  } 
                  title={act.title}
                  meta={`${formatDistanceToNow(act.date, { addSuffix: true })} • By ${session?.user?.name || "You"}`}
                  isLast={idx === activity.length - 1}
                />
              ))
            ) : (
              <p className="text-sm text-gray-400 py-4">No recent activity.</p>
            )}
          </div>
        </div>

        {/* RIGHT — AI Insights */}
        <div className="bg-[#222222] border border-white/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-purple-400" />
            <h2 className="text-base font-semibold text-white">AI Insights</h2>
          </div>

          <div className="flex flex-col gap-3">
            {insights.map((insight) => (
              <div 
                key={insight.id}
                className={`border border-white/5 rounded-lg p-4 ${insight.color === "purple" ? "bg-[#2a2020]" : "bg-[#1e2a1e]"}`}
              >
                <h3 className={`text-sm font-medium mb-1 ${insight.color === "purple" ? "text-purple-400" : "text-green-400"}`}>
                  {insight.title}
                </h3>
                <p className="text-xs text-gray-400 line-clamp-2">
                  {insight.body}
                </p>
                <Link 
                  href={insight.href}
                  className="w-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-sm text-white rounded-md py-2 mt-3 transition-colors"
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
    <div className="bg-[#222222] rounded-xl p-5 border border-white/5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm text-gray-400">{title}</h3>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">{value}</span>
        <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
          {change}
        </span>
      </div>
    </div>
  );
}

function ActivityRow({ icon, title, meta, isLast = false }: { icon: React.ReactNode, title: string, meta: string, isLast?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${!isLast ? 'border-b border-white/5' : ''}`}>
      <div className="w-[36px] h-[36px] bg-white/5 rounded-full flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm text-white truncate max-w-[200px] sm:max-w-[300px] md:max-w-[400px]">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
      </div>
    </div>
  );
}
