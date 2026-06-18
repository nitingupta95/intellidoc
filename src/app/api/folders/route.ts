import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return new NextResponse("Workspace ID is required", { status: 400 });
    }

    const folders = await db.folder.findMany({
      where: {
        workspaceId,
      },
      include: {
        children: true,
        _count: {
          select: { documents: true }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(folders);
  } catch (error) {
    console.error("[FOLDERS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { name, workspaceId, parentId } = body;

    if (!name || !workspaceId) {
      return new NextResponse("Name and Workspace ID are required", { status: 400 });
    }

    // Verify workspace access
    const workspace = await db.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: session.user.id },
          { members: { some: { userId: session.user.id } } }
        ]
      }
    });

    if (!workspace) {
      return new NextResponse("Workspace not found or access denied", { status: 404 });
    }

    const folder = await db.folder.create({
      data: {
        name,
        workspaceId,
        parentId: parentId || null
      }
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error("[FOLDERS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
