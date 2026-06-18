"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getDocuments(workspaceId: string) {
  try {
    const docs = await db.document.findMany({
      where: { workspaceId },
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
  uploadedBy: string;
  storageKey: string;
  workspaceId: string;
  knowledgeBaseId?: string | null;
  folderId?: string | null;
}) {
  try {
    const doc = await db.document.create({
      data: {
        title: data.title,
        filename: data.filename,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        uploadedBy: data.uploadedBy,
        storageKey: data.storageKey,
        status: "UPLOADED",
        workspaceId: data.workspaceId,
        knowledgeBaseId: data.knowledgeBaseId || null,
        folderId: data.folderId || null,
      },
    });
    
    revalidatePath("/documents");
    revalidatePath(`/workspaces/${data.workspaceId}`);
    return { success: true, data: doc };
  } catch (error) {
    console.error("Failed to create document record:", error);
    return { success: false, error: "Failed to create record." };
  }
}
