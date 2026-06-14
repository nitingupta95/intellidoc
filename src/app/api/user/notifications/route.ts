import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { notificationPrefs: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found in database. Please log out and log in again." }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      preferences: user?.notificationPrefs || null 
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    try {
      await db.user.update({
        where: { id: session.user.id },
        data: { notificationPrefs: body.preferences }
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ success: false, error: 'User not found in database. Please log out and log in again.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save notifications error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
