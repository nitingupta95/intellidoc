import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    // Verify user is member of workspace
    const member = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const knowledgeBases = await db.knowledgeBase.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { documents: true }
        }
      }
    });

    return NextResponse.json({ knowledgeBases });
  } catch (error) {
    console.error("GET KnowledgeBases error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, workspaceId } = body;

    if (!name || !workspaceId) {
      return NextResponse.json({ error: "Name and Workspace ID are required" }, { status: 400 });
    }

    // Verify user is member of workspace
    const member = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const kb = await db.knowledgeBase.create({
      data: {
        name,
        description,
        workspaceId,
      },
    });

    return NextResponse.json(kb);
  } catch (error) {
    console.error("POST KnowledgeBase error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
