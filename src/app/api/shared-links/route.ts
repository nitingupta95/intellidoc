import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { resourceId, resourceType, workspaceId, expiresInDays } = body;

    if (!resourceId || !resourceType || !workspaceId) {
      return new NextResponse("Missing required fields", { status: 400 });
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

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    
    let expiresAt = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));
    }

    const sharedLink = await db.sharedLink.create({
      data: {
        token,
        resourceId,
        resourceType,
        workspaceId,
        createdBy: session.user.id,
        expiresAt
      }
    });

    return NextResponse.json(sharedLink);
  } catch (error) {
    console.error("[SHARED_LINKS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
