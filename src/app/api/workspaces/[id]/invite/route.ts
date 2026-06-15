import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { emailService } from "@/lib/email";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: workspaceId } = await params;
    const { email, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      const isMember = await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      });
      if (isMember) {
        return NextResponse.json({ error: "User is already a member" }, { status: 400 });
      }
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await db.invitation.create({
      data: {
        workspaceId,
        email,
        role,
        token,
        status: "PENDING",
        expiresAt,
        invitedBy: userId,
      },
    });

    // Send email using Nodemailer
    const inviterName = session.user.name || "A team member";
    console.log(`Sending invite email to ${email} with token: ${token}`);
    await emailService.sendWorkspaceInvite(email, token, inviterName, workspace.name);

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error: any) {
    console.error("Invite error:", error);
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 });
  }
}
