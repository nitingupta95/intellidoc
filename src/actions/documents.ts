"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getDocuments() {
  try {
    const docs = await db.document.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: docs };
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return { success: false, error: "Failed to fetch documents." };
  }
}

export async function createDocumentRecord(data: {
  title: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  userId: string;
  storageKey: string;
  knowledgeBaseId?: string;
}) {
  try {
    const doc = await db.document.create({
      data: {
        title: data.title,
        filename: data.filename,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        userId: data.userId,
        storageKey: data.storageKey,
        status: "UPLOADED",
        knowledgeBaseId: data.knowledgeBaseId || null,
      },
    });
    
    revalidatePath("/documents");
    if (data.knowledgeBaseId) {
      revalidatePath(`/knowledge-bases/${data.knowledgeBaseId}`);
    }
    return { success: true, data: doc };
  } catch (error) {
    console.error("Failed to create document record:", error);
    return { success: false, error: "Failed to create record." };
  }
}
