import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    
    const invitation = await db.invitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: { name: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
    }

    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invitation expired or already used" }, { status: 400 });
    }

    return NextResponse.json({ invitation });
  } catch (error: any) {
    console.error("Fetch invite error:", error);
    return NextResponse.json({ error: "Failed to fetch invite" }, { status: 500 });
  }
}
