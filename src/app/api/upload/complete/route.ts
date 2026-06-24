import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { publishDocumentJob } from "@/lib/rabbitmq";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    // Fetch the document to verify ownership and get metadata
    const document = await db.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.uploadedBy !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Trigger RabbitMQ Job now that the file is fully uploaded to S3
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
