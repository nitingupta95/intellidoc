import { NextResponse } from "next/server";
import { uploadFileToStorage } from "@/lib/storage";
import { createDocumentRecord } from "@/actions/documents";
import { auth } from "@/auth";
import { env } from '../../../env';
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
      userId: session.user.id,
    });

    if (!dbRecord.success) {
      throw new Error("Failed to save to database");
    }

    // 3. Trigger FastAPI Background Processing
    try {
      const userRecord = await prisma.user.findUnique({ where: { id: session.user.id } });
      const userOpenAIKey = userRecord?.openaiKey || process.env.OPENAI_API_KEY || "";
      const userGeminiKey = userRecord?.geminiKey || process.env.GEMINI_API_KEY || "";

      const aiUrl = env.AI_SERVICE_URL;
      await fetch(`${aiUrl}/api/v1/documents/process`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-OpenAI-API-Key': userOpenAIKey,
          'X-Gemini-API-Key': userGeminiKey
        },
        body: JSON.stringify({
          document_id: dbRecord.data!.id,
          file_path: `minio://${process.env.S3_BUCKET_NAME || "intellidoc-documents"}/${uniqueFileName}`,
          metadata: {
            title: dbRecord.data!.title,
            userId: session.user.id
          }
        })
      });
    } catch (aiError) {
      console.error("FastAPI triggered failed (is docker running?):", aiError);
      // We don't fail the upload if AI is temporarily down, just log it.
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
