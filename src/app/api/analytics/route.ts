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

    return NextResponse.json({
      metrics: {
        totalDocuments,
        totalQueries,
        storageGB,
        activeUsers: activeUsersCount
      },
      queryData,
      storageData
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
