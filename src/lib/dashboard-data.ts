import { db } from "@/lib/db";

export interface DashboardData {
  totalDocuments: number;
  aiQueries: number;
  avgConfidence: number;
  timeSavedHours: number;
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
  // 1. Total Documents
  const totalDocuments = await db.document.count({
    where: { workspace: { members: { some: { userId } } } },
  });

  // 2. AI Queries
  const aiQueries = await db.message.count({
    where: {
      role: "user",
      conversation: { workspace: { members: { some: { userId } } } },
    },
  });

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
  const recentDocs = await db.document.findMany({
    where: { workspace: { members: { some: { userId } } } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, filename: true, createdAt: true },
  });

  const recentConvos = await db.conversation.findMany({
    where: { workspace: { members: { some: { userId } } } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, createdAt: true },
  });

  const activity = [
    ...recentDocs.map(d => ({
      id: d.id,
      type: "document" as const,
      title: `Uploaded '${d.filename}'`,
      date: d.createdAt,
    })),
    ...recentConvos.map(c => ({
      id: c.id,
      type: "conversation" as const,
      title: `Asked about '${c.title}'`,
      date: c.createdAt,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 4);

  // 6. AI Insights
  const insights = [];
  
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
    activity,
    insights,
  };
}
