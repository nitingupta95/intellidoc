import { NextResponse } from "next/server";
import { uploadFileToStorage } from "@/lib/storage";
import { createDocumentRecord } from "@/actions/documents";
import { auth } from "@/auth";
import { env } from '../../../env';
import { prisma } from "@/lib/db";
import { publishDocumentJob } from "@/lib/rabbitmq";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const workspaceId = formData.get("workspaceId") as string;
    const knowledgeBaseId = formData.get("knowledgeBaseId") as string | null;
    const folderId = formData.get("folderId") as string | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File size exceeds the 20MB limit." }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: "No workspaceId provided" }, { status: 400 });
    }

    // Convert Web File to Node.js Buffer for S3 SDK
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create unique filename
    const uniqueFileName = `${crypto.randomUUID()}-${file.name}`;

    // 1. Upload to MinIO/S3
    await uploadFileToStorage(buffer, uniqueFileName, file.type);

    // 2. Save metadata to Postgres via Prisma (Server Action)
    const dbRecord = await createDocumentRecord({
      title: file.name.split('.').slice(0, -1).join('.'),
      filename: uniqueFileName,
      storageKey: uniqueFileName,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: session.user.id,
      workspaceId,
      knowledgeBaseId,
      folderId,
    });

    if (!dbRecord.success) {
      throw new Error("Failed to save to database");
    }

    // 3. Trigger RabbitMQ Job
    try {
      const minioPath = `minio://${process.env.S3_BUCKET_NAME || "intellidoc-documents"}/${uniqueFileName}`;
      await publishDocumentJob(
        dbRecord.data!.id,
        minioPath,
        session.user.id,
        workspaceId,
        knowledgeBaseId || null
      );
    } catch (mqError) {
      console.error("Failed to push job to RabbitMQ:", mqError);
      // We don't fail the upload if MQ is temporarily down, just log it.
    }

    return NextResponse.json({ 
      success: true, 
      document: dbRecord.data 
    });

  } catch (error) {
    console.error("Upload route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
