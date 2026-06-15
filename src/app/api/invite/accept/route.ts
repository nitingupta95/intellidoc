import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    const invitation = await db.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
    }

    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invitation expired or already used" }, { status: 400 });
    }

    if (invitation.email !== userEmail) {
      return NextResponse.json({ error: "Invitation email does not match logged-in user" }, { status: 403 });
    }

    // Check if user is already a member
    const existingMembership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
    });

    if (existingMembership) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    // Process accept
    await db.$transaction([
      db.workspaceMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      }),
      db.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      }),
    ]);

    return NextResponse.json({ success: true, workspaceId: invitation.workspaceId });
  } catch (error: any) {
    console.error("Accept invite error:", error);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
