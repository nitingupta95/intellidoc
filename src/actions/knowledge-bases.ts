"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function getKnowledgeBases() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userWorkspaces = await db.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true }
    });
    
    const workspaceIds = userWorkspaces.map(t => t.workspaceId);

    const kbs = await db.knowledgeBase.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { documents: true }
        }
      }
    });
    return { success: true, data: kbs };
  } catch (error) {
    console.error("Failed to fetch knowledge bases:", error);
    return { success: false, error: "Failed to fetch knowledge bases." };
  }
}

export async function createKnowledgeBase(data: { name: string; description?: string; workspaceId?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }
    
    const userId = session.user.id;
    let targetWorkspaceId = data.workspaceId;

    if (!targetWorkspaceId || targetWorkspaceId === "team_123") {
      const workspaceMember = await db.workspaceMember.findFirst({
        where: { userId },
        include: { workspace: true }
      });
      
      if (workspaceMember) {
        targetWorkspaceId = workspaceMember.workspaceId;
      } else {
        const newWorkspace = await db.workspace.create({
          data: {
            name: `${session.user.name || 'Personal'}'s Workspace`,
            ownerId: userId,
            members: {
              create: {
                userId,
                role: "OWNER"
              }
            }
          }
        });
        targetWorkspaceId = newWorkspace.id;
      }
    }

    const kb = await db.knowledgeBase.create({
      data: {
        name: data.name,
        description: data.description,
        workspaceId: targetWorkspaceId as string,
      },
    });
    
    revalidatePath("/knowledge-bases");
    return { success: true, data: kb };
  } catch (error) {
    console.error("Failed to create knowledge base:", error);
    return { success: false, error: "Failed to create knowledge base." };
  }
}

export async function getKnowledgeBase(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const kb = await db.knowledgeBase.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!kb) {
      return { success: false, error: "Knowledge base not found" };
    }

    // Verify user has access to this workspace's KB
    const workspaceMember = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: kb.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMember) {
      return { success: false, error: "Unauthorized access to this knowledge base" };
    }

    return { success: true, data: kb };
  } catch (error) {
    console.error("Failed to fetch knowledge base:", error);
    return { success: false, error: "Failed to fetch knowledge base." };
  }
}

export async function updateKnowledgeBase(id: string, data: { name: string; description?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const kb = await db.knowledgeBase.findUnique({ where: { id } });
    if (!kb) return { success: false, error: "Knowledge base not found" };

    // Verify access
    const workspaceMember = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: kb.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMember) return { success: false, error: "Unauthorized" };

    const updatedKb = await db.knowledgeBase.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      },
    });

    revalidatePath("/knowledge-bases");
    revalidatePath(`/knowledge-bases/${id}`);
    return { success: true, data: updatedKb };
  } catch (error) {
    console.error("Failed to update knowledge base:", error);
    return { success: false, error: "Failed to update knowledge base." };
  }
}

export async function deleteKnowledgeBase(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const kb = await db.knowledgeBase.findUnique({ where: { id } });
    if (!kb) return { success: false, error: "Knowledge base not found" };

    // Verify access
    const workspaceMember = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: kb.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMember) return { success: false, error: "Unauthorized" };

    await db.knowledgeBase.delete({ where: { id } });

    revalidatePath("/knowledge-bases");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete knowledge base:", error);
    return { success: false, error: "Failed to delete knowledge base." };
  }
}

export async function addDocumentToKnowledgeBase(documentId: string, knowledgeBaseId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const kb = await db.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
    if (!kb) return { success: false, error: "Knowledge base not found" };

    // Verify user owns the document or has access to the KB's workspace
    const workspaceMember = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: kb.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMember) return { success: false, error: "Unauthorized access to KB" };

    // Also could verify document ownership here if required

    const doc = await db.document.update({
      where: { id: documentId },
      data: { knowledgeBaseId },
    });

    revalidatePath(`/knowledge-bases/${knowledgeBaseId}`);
    return { success: true, data: doc };
  } catch (error) {
    console.error("Failed to add document to knowledge base:", error);
    return { success: false, error: "Failed to add document to knowledge base." };
  }
}

export async function removeDocumentFromKnowledgeBase(documentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const document = await db.document.findUnique({ where: { id: documentId } });
    if (!document) return { success: false, error: "Document not found" };

    // Verify document ownership or team permissions
    if (document.uploadedBy !== session.user.id) {
      return { success: false, error: "Unauthorized" };
    }

    const kbId = document.knowledgeBaseId;

    const doc = await db.document.update({
      where: { id: documentId },
      data: { knowledgeBaseId: null },
    });

    if (kbId) revalidatePath(`/knowledge-bases/${kbId}`);
    return { success: true, data: doc };
  } catch (error) {
    console.error("Failed to remove document from knowledge base:", error);
    return { success: false, error: "Failed to remove document from knowledge base." };
  }
}
