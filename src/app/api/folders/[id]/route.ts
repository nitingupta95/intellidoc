import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await params;
    const body = await req.json();
    const { name, parentId } = body;

    const folder = await db.folder.update({
      where: {
        id: resolvedParams.id,
      },
      data: {
        ...(name && { name }),
        ...(parentId !== undefined && { parentId })
      }
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error("[FOLDER_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await params;

    // This uses cascade delete for children, or handles it if not setup with cascade.
    // In our schema, Folders to Folders is SetNull for parent.
    // So we need to delete the folder itself.
    const folder = await db.folder.delete({
      where: {
        id: resolvedParams.id,
      }
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error("[FOLDER_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
