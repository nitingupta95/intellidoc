import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, image } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (image !== undefined) updateData.image = image;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    let updatedUser;
    try {
      updatedUser = await db.user.update({
        where: { id: session.user.id },
        data: updateData,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ success: false, error: 'User not found in database. Please log out and log in again.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, user: { name: updatedUser.name, image: updatedUser.image } });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
