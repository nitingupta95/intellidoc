import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createDocumentRecord } from "@/actions/documents";
import { publishDocumentJob } from "@/lib/rabbitmq";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { storageKey, fileName, fileType, fileSize, workspaceId, knowledgeBaseId, folderId } = body;

    if (!storageKey || !workspaceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Now that the file is successfully uploaded to S3, we create the database record
    const dbRecord = await createDocumentRecord({
      title: fileName.split('.').slice(0, -1).join('.'),
      filename: storageKey, // We use storageKey as filename to avoid duplicates
      storageKey: storageKey,
      fileSize: fileSize,
      mimeType: fileType,
      uploadedBy: session.user.id,
      workspaceId,
      knowledgeBaseId,
      folderId,
    });

    if (!dbRecord.success || !dbRecord.data) {
      return NextResponse.json({ error: "Failed to create database record" }, { status: 500 });
    }

    const document = dbRecord.data;

    // Trigger RabbitMQ Job
    try {
      const minioPath = `minio://${process.env.S3_BUCKET_NAME || "intellidoc-documents"}/${document.storageKey}`;
      await publishDocumentJob(
        document.id,
        minioPath,
        session.user.id,
        document.workspaceId,
        document.knowledgeBaseId || null
      );
    } catch (mqError) {
      console.error("Failed to push job to RabbitMQ:", mqError);
      // We don't fail the upload if MQ is temporarily down, but log it.
    }

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error("Upload complete route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
