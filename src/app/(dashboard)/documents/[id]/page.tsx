"use client";

import { useEffect, useState, use } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Loader2, ArrowLeft, MessageSquare, FileText, Calendar, HardDrive, AlertCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DocumentPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const documentId = resolvedParams.id;
  const { activeWorkspaceId } = useWorkspaceStore();
  const router = useRouter();
  
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!documentId || !activeWorkspaceId) return;
    setIsSharing(true);
    try {
      const res = await fetch("/api/shared-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: documentId,
          resourceType: "DOCUMENT",
          workspaceId: activeWorkspaceId
        })
      });
      if (res.ok) {
        const data = await res.json();
        const url = `${window.location.origin}/shared/${data.token}`;
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard!");
      } else {
        throw new Error("Failed to share");
      }
    } catch (e) {
      toast.error("Could not generate share link.");
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    if (!documentId) return;

    fetch(`/api/documents/${documentId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch document");
        return res.json();
      })
      .then(data => {
        if (data.document) {
          setDoc(data.document);
        } else {
          setError("Document not found");
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Error Loading Document</h2>
        <p className="text-muted-foreground">{error || "Document not found"}</p>
        <Link href="/documents">
          <Button variant="outline">Back to Documents</Button>
        </Link>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fileUrl = `/api/documents/${documentId}/download`;

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between shrink-0 mb-6 bg-background/50 glass-panel p-4 rounded-xl border border-border/50 gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto overflow-hidden">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0 overflow-hidden">
              <h1 className="text-xl font-heading font-semibold truncate" title={doc.filename}>{doc.filename}</h1>
              <p className="text-sm text-muted-foreground capitalize truncate">{doc.status.toLowerCase()}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          <Button variant="outline" className="gap-2" onClick={handleShare} disabled={isSharing}>
            {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Link href={`/chat?documentId=${doc.id}&documentTitle=${encodeURIComponent(doc.filename)}`}>
            <Button className="gap-2">
              <MessageSquare size={16} />
              <span className="hidden sm:inline">Chat with this doc</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Document Viewer */}
        <div className="flex-1 glass-panel border border-border/50 overflow-hidden rounded-xl bg-muted/20 relative min-h-[400px]">
          {doc.mimeType?.includes('pdf') || doc.mimeType?.includes('text') || doc.mimeType?.includes('json') ? (
            <iframe 
              src={fileUrl} 
              className="w-full h-full border-none bg-background"
              title={doc.filename}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-center p-6">
              <FileText className="w-16 h-16 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold">Preview not available</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                This file type cannot be previewed directly in the browser. You can still chat with it or download it.
              </p>
              <a href={fileUrl} download>
                <Button variant="outline">Download File</Button>
              </a>
            </div>
          )}
        </div>

        {/* Metadata Sidebar */}
        <div className="w-full lg:w-80 shrink-0 space-y-6 overflow-y-auto pb-6">
          <div className="glass-panel p-5 border border-border/50 rounded-xl">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Document Details</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground flex items-center gap-2"><Calendar size={14} /> Uploaded</span>
                <span className="font-medium">{new Date(doc.createdAt).toLocaleString()}</span>
              </div>
              
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground flex items-center gap-2"><HardDrive size={14} /> File Size</span>
                <span className="font-medium">{formatBytes(doc.fileSize || 0)}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground flex items-center gap-2"><FileText size={14} /> Content Type</span>
                <span className="font-medium truncate" title={doc.mimeType}>{doc.mimeType || 'Unknown'}</span>
              </div>

              {doc.chunkCount !== null && (
                <div className="flex flex-col gap-1 pt-4 border-t border-border/50">
                  <span className="text-muted-foreground">Indexed Chunks</span>
                  <span className="font-medium">{doc.chunkCount} chunks</span>
                </div>
              )}
              
              {doc.embeddingModel && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground">Embedding Model</span>
                  <span className="font-medium text-xs bg-muted px-2 py-1 rounded w-fit">{doc.embeddingModel}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
