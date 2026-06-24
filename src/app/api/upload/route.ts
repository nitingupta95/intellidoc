import { NextResponse } from "next/server";
import { getUploadPresignedUrl } from "@/lib/storage";
import { createDocumentRecord } from "@/actions/documents";
import { auth } from "@/auth";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fileName, fileType, fileSize, workspaceId, knowledgeBaseId, folderId } = body;

    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json({ error: "Missing file details" }, { status: 400 });
    }

    const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
    if (fileSize > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File size exceeds the 20MB limit." }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspaceId provided" }, { status: 400 });
    }

    // Create unique filename
    const uniqueFileName = `${crypto.randomUUID()}-${fileName}`;

    // Create a presigned URL for direct S3 upload
    const presignedUrl = await getUploadPresignedUrl(uniqueFileName, fileType);

    // Save metadata to Postgres via Prisma (Server Action)
    const dbRecord = await createDocumentRecord({
      title: fileName.split('.').slice(0, -1).join('.'),
      filename: uniqueFileName,
      storageKey: uniqueFileName,
      fileSize: fileSize,
      mimeType: fileType,
      uploadedBy: session.user.id,
      workspaceId,
      knowledgeBaseId,
      folderId,
    });

    if (!dbRecord.success) {
      throw new Error("Failed to save to database");
    }

    // Return the presigned URL and document ID. RabbitMQ job will be triggered later.
    return NextResponse.json({ 
      success: true, 
      presignedUrl,
      documentId: dbRecord.data!.id,
      storageKey: uniqueFileName
    });

  } catch (error) {
    console.error("Upload route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
