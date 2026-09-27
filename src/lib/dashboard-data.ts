import { db } from "@/lib/db";
import { truncateWords } from "@/lib/utils";

const CHANGE_WINDOW_DAYS = 30;
const TREND_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** % growth vs `previous`; null when there is no earlier data to compare against. */
function percentChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

export interface DashboardData {
  totalDocuments: number;
  aiQueries: number;
  avgConfidence: number;
  timeSavedHours: number;
  /** % change vs CHANGE_WINDOW_DAYS ago; null = no history, hide the badge */
  documentsChange: number | null;
  queriesChange: number | null;
  /** AI queries per day, oldest first, last TREND_DAYS days */
  queryTrend: number[];
  activity: {
    id: string;
    type: "document" | "conversation";
    title: string;
    date: Date;
  }[];
  insights: {
    id: string;
    type: string;
    title: string;
    body: string;
    button: string;
    href: string;
    color: string;
  }[];
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const inMyWorkspaces = { workspace: { members: { some: { userId } } } };
  const myQueries = { role: "user", conversation: inMyWorkspaces };
  const now = Date.now();
  const windowStart = new Date(now - CHANGE_WINDOW_DAYS * DAY_MS);
  const trendStart = new Date(now - (TREND_DAYS - 1) * DAY_MS);
  trendStart.setHours(0, 0, 0, 0);

  // 1. Total Documents / 2. AI Queries, now and at the start of the change window
  const [totalDocuments, documentsBefore, aiQueries, queriesBefore, trendMessages] = await Promise.all([
    db.document.count({ where: inMyWorkspaces }),
    db.document.count({ where: { ...inMyWorkspaces, createdAt: { lt: windowStart } } }),
    db.message.count({ where: myQueries }),
    db.message.count({ where: { ...myQueries, createdAt: { lt: windowStart } } }),
    // ponytail: buckets in JS; switch to a date_trunc groupBy if query volume gets large
    db.message.findMany({ where: { ...myQueries, createdAt: { gte: trendStart } }, select: { createdAt: true } }),
  ]);

  const queryTrend = new Array(TREND_DAYS).fill(0);
  for (const { createdAt } of trendMessages) {
    const day = Math.floor((createdAt.getTime() - trendStart.getTime()) / DAY_MS);
    if (day >= 0 && day < TREND_DAYS) queryTrend[day]++;
  }

  // 3. Avg Confidence
  const assistantMessages = await db.message.findMany({
    where: {
      role: "assistant",
      conversation: { workspace: { members: { some: { userId } } } },
      confidence: { not: null },
    },
    select: { confidence: true },
  });
  
  let avgConfidence = 0;
  if (assistantMessages.length > 0) {
    const sum = assistantMessages.reduce((acc, msg) => acc + (msg.confidence || 0), 0);
    avgConfidence = (sum / assistantMessages.length) * 100;
  }

  // 4. Time Saved (5 mins per query)
  const timeSavedHours = Math.round((aiQueries * 5) / 60);

  // 5. Recent Knowledge Activity
  // `filename` holds the storage key for direct uploads; `title` is the display name.
  const recentDocs = await db.document.findMany({
    where: inMyWorkspaces,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, filename: true, createdAt: true },
  });

  // Conversation titles are stored pre-truncated, so use the first question itself.
  const recentConvos = await db.conversation.findMany({
    where: inMyWorkspaces,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      createdAt: true,
      messages: { where: { role: "user" }, orderBy: { createdAt: "asc" }, take: 1, select: { content: true } },
    },
  });

  const docName = (d: { title: string | null; filename: string }) => d.title || d.filename;

  const activity = [
    ...recentDocs.map(d => ({
      id: d.id,
      type: "document" as const,
      title: `Uploaded '${truncateWords(docName(d), 60)}'`,
      date: d.createdAt,
    })),
    ...recentConvos.map(c => ({
      id: c.id,
      type: "conversation" as const,
      title: `Asked '${truncateWords(c.messages[0]?.content || c.title, 60)}'`,
      date: c.createdAt,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    // the same question asked in back-to-back chats should appear once
    .filter((a, i, all) => i === 0 || a.title !== all[i - 1].title)
    .slice(0, 4);

  // 6. AI Insights
  const insights = [];
  
  if (recentDocs.length > 0) {
    insights.push({
      id: "cluster",
      type: "cluster",
      title: "New Topic Indexed",
      body: `You recently uploaded '${docName(recentDocs[0])}'. Our AI is now ready to answer questions about it.`,
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

  return {
    totalDocuments,
    aiQueries,
    avgConfidence,
    timeSavedHours,
    documentsChange: percentChange(totalDocuments, documentsBefore),
    queriesChange: percentChange(aiQueries, queriesBefore),
    queryTrend,
    activity,
    insights,
  };
}
