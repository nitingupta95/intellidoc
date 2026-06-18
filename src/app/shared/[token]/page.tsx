import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { FileText, MessageSquare, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function SharedResourcePage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  const sharedLink = await db.sharedLink.findUnique({
    where: { token },
    include: {
      user: {
        select: { name: true }
      }
    }
  });

  if (!sharedLink) {
    notFound();
  }

  // Check expiration
  if (sharedLink.expiresAt && sharedLink.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="max-w-md w-full glass-panel p-8 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Link Expired</h1>
          <p className="text-muted-foreground">This shared link is no longer valid.</p>
        </div>
      </div>
    );
  }

  // Increment access count
  await db.sharedLink.update({
    where: { id: sharedLink.id },
    data: { accessCount: { increment: 1 } }
  });

  let resource = null;
  if (sharedLink.resourceType === 'DOCUMENT') {
    resource = await db.document.findUnique({ where: { id: sharedLink.resourceId } });
  } else if (sharedLink.resourceType === 'CONVERSATION') {
    resource = await db.conversation.findUnique({ 
      where: { id: sharedLink.resourceId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
  }

  if (!resource) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col p-4 md:p-8 items-center">
      <div className="w-full max-w-4xl glass-panel border border-border/50 rounded-2xl p-6 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {sharedLink.resourceType === 'DOCUMENT' ? <FileText className="text-primary" /> : <MessageSquare className="text-primary" />}
            {(resource as any).title || (resource as any).filename || "Shared Resource"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Shared by {sharedLink.user?.name || "Anonymous"}</p>
        </div>
        <Button variant="outline" asChild>
          <a href="/">Go to IntelliDoc</a>
        </Button>
      </div>

      <div className="w-full max-w-4xl glass-panel border border-border/50 rounded-2xl overflow-hidden min-h-[60vh] bg-muted/20 relative p-6">
        {sharedLink.resourceType === 'DOCUMENT' && (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <FileText className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-xl font-medium">{(resource as any).filename}</h2>
            <p className="text-muted-foreground">{(resource as any).summary || "No summary available"}</p>
            <Button asChild>
              <a href={`/api/documents/${(resource as any).id}/download`} download>Download Document</a>
            </Button>
          </div>
        )}

        {sharedLink.resourceType === 'CONVERSATION' && (
          <div className="flex flex-col space-y-4 max-w-3xl mx-auto">
            {(resource as any).messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
