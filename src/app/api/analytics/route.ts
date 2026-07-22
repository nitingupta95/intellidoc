import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return new NextResponse("Workspace ID required", { status: 400 });
    }

    // Verify workspace access
    const isMember = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!isMember) {
      return new NextResponse("Unauthorized for this workspace", { status: 403 });
    }

    // 1. Total Documents & Vector Storage (approx size)
    const docs = await db.document.findMany({
      where: { workspaceId },
      select: { fileSize: true, createdAt: true },
    });

    const totalDocuments = docs.length;
    const totalStorageBytes = docs.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
    const storageGB = (totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

    // 2. Active Users (Users who have sent a message in this workspace in the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await db.message.groupBy({
      by: ['conversationId'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        conversation: { workspaceId }
      },
    });
    // We actually need unique users, but messages don't have userId directly, they link to conversation which has userId
    const conversationsWithActivity = await db.conversation.findMany({
      where: {
        workspaceId,
        messages: { some: { createdAt: { gte: thirtyDaysAgo } } }
      },
      select: { userId: true },
    });
    
    const uniqueUserIds = new Set(conversationsWithActivity.map(c => c.userId));
    const activeUsersCount = uniqueUserIds.size;

    // 3. AI Queries (Total user messages)
    const totalQueries = await db.message.count({
      where: {
        role: "user",
        conversation: { workspaceId }
      }
    });

    // 4. Query Volume over last 7 days (Daily)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentMessages = await db.message.findMany({
      where: {
        role: "user",
        createdAt: { gte: sevenDaysAgo },
        conversation: { workspaceId }
      },
      select: { createdAt: true }
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const queryDataMap = new Map();
    
    // Initialize last 7 days with 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      queryDataMap.set(days[d.getDay()], 0);
    }

    recentMessages.forEach(msg => {
      const dayName = days[msg.createdAt.getDay()];
      queryDataMap.set(dayName, (queryDataMap.get(dayName) || 0) + 1);
    });

    // Convert map to array preserving order of last 7 days
    const queryData = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dayName = days[d.getDay()];
      queryData.push({ name: dayName, queries: queryDataMap.get(dayName) });
    }

    // 5. Storage growth over last 6 months
    const storageData = [];
    const currentMonth = new Date().getMonth();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let cumulativeSize = 0;
    // Calculate size of docs created before 6 months ago
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const oldDocs = docs.filter(d => d.createdAt < sixMonthsAgo);
    cumulativeSize += oldDocs.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(currentMonth - i);
      const monthIdx = d.getMonth();
      const year = d.getFullYear();
      
      const monthDocs = docs.filter(doc => 
        doc.createdAt.getMonth() === monthIdx && doc.createdAt.getFullYear() === year
      );
      
      cumulativeSize += monthDocs.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
      storageData.push({
        name: monthNames[monthIdx],
        usage: parseFloat((cumulativeSize / (1024 * 1024 * 1024)).toFixed(3)) // GB
      });
    }

    // ── RAGAS Quality Metrics ────────────────────────────────────────────────
    // Fetch all evaluated assistant messages (those with at least one RAGAS score)
    const evaluatedMessages = await db.message.findMany({
      where: {
        role: 'assistant',
        conversation: { workspaceId },
        faithfulness: { not: null },
      },
      select: {
        faithfulness: true,
        answerRelevancy: true,
        contextPrecision: true,
        contextRecall: true,
        createdAt: true,
      },
    });

    // Helper: average over non-null values
    const avg = (arr: (number | null)[]) => {
      const valid = arr.filter((v): v is number => v !== null && v >= 0);
      return valid.length > 0 ? parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(4)) : null;
    };

    const ragasAvg = {
      faithfulness:     avg(evaluatedMessages.map(m => m.faithfulness)),
      answerRelevancy:  avg(evaluatedMessages.map(m => m.answerRelevancy)),
      contextPrecision: avg(evaluatedMessages.map(m => m.contextPrecision)),
      contextRecall:    avg(evaluatedMessages.map(m => m.contextRecall)),
      evaluatedCount:   evaluatedMessages.length,
      totalAssistantMessages: await db.message.count({
        where: { role: 'assistant', conversation: { workspaceId } }
      }),
    };

    // Daily RAGAS trend — last 7 days, one data point per day
    const ragasTrend: {
      name: string;
      faithfulness: number | null;
      answerRelevancy: number | null;
      contextPrecision: number | null;
      contextRecall: number | null;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayMsgs = evaluatedMessages.filter(
        m => m.createdAt >= dayStart && m.createdAt <= dayEnd
      );

      ragasTrend.push({
        name: days[dayStart.getDay()],
        faithfulness:     avg(dayMsgs.map(m => m.faithfulness)),
        answerRelevancy:  avg(dayMsgs.map(m => m.answerRelevancy)),
        contextPrecision: avg(dayMsgs.map(m => m.contextPrecision)),
        contextRecall:    avg(dayMsgs.map(m => m.contextRecall)),
      });
    }

    // Score health distribution — for each metric bucket into good/fair/poor
    const bucketScore = (val: number | null) => {
      if (val === null) return null;
      if (val >= 0.7) return 'good';
      if (val >= 0.4) return 'fair';
      return 'poor';
    };

    const scoreDistribution = {
      faithfulness:     { good: 0, fair: 0, poor: 0 },
      answerRelevancy:  { good: 0, fair: 0, poor: 0 },
      contextPrecision: { good: 0, fair: 0, poor: 0 },
      contextRecall:    { good: 0, fair: 0, poor: 0 },
    };
    for (const msg of evaluatedMessages) {
      for (const metric of ['faithfulness', 'answerRelevancy', 'contextPrecision', 'contextRecall'] as const) {
        const bucket = bucketScore(msg[metric]);
        if (bucket) scoreDistribution[metric][bucket]++;
      }
    }

    return NextResponse.json({
      metrics: {
        totalDocuments,
        totalQueries,
        storageGB,
        activeUsers: activeUsersCount
      },
      queryData,
      storageData,
      ragas: {
        averages: ragasAvg,
        trend: ragasTrend,
        distribution: scoreDistribution,
      },
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
