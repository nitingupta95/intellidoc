"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Upload, FileText, Loader2, MessageSquare, Trash2, ArrowLeft, MoreVertical, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const formatMimeType = (mime: string) => {
  if (!mime) return "FILE";
  const lower = mime.toLowerCase();
  if (lower.includes("wordprocessingml.document")) return "DOCX";
  if (lower.includes("spreadsheetml.sheet")) return "XLSX";
  if (lower.includes("presentationml.presentation")) return "PPTX";
  if (lower.includes("pdf")) return "PDF";
  if (lower.includes("csv")) return "CSV";
  if (lower.includes("plain")) return "TXT";
  if (lower.includes("markdown")) return "MD";
  if (lower.includes("json")) return "JSON";
  
  const parts = mime.split("/");
  const ext = parts[1]?.toUpperCase() || "FILE";
  if (ext.length > 10) return ext.substring(0, 10) + "...";
  return ext;
};

export default function KnowledgeBaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { activeWorkspaceId } = useWorkspaceStore();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kb, setKb] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isAddExistingOpen, setIsAddExistingOpen] = useState(false);
  const [workspaceDocuments, setWorkspaceDocuments] = useState<any[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId || !id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch KB details
        const kbRes = await fetch(`/api/knowledge-bases?workspaceId=${activeWorkspaceId}`);
        const kbData = await kbRes.json();
        const foundKb = kbData.knowledgeBases?.find((k: any) => k.id === id);
        if (foundKb) setKb(foundKb);

        // Fetch documents for this KB
        await fetchDocuments();
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, id]);

  const fetchDocuments = async (silent = false) => {
    if (!activeWorkspaceId || !id) return;
    try {
      const res = await fetch(`/api/documents?workspaceId=${activeWorkspaceId}&knowledgeBaseId=${id}`);
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents", error);
    }
  };

  useEffect(() => {
    const hasProcessingDocs = documents.some(doc => doc.status === 'UPLOADED' || doc.status === 'PROCESSING');
    if (!hasProcessingDocs) return;

    const interval = setInterval(() => {
      fetchDocuments(true);
    }, 3000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeWorkspaceId || !id) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspaceId", activeWorkspaceId);
      formData.append("knowledgeBaseId", id);
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      await fetchDocuments(true);
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload document.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(docs => docs.filter(doc => doc.id !== docId));
        toast.success("Document deleted");
      }
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  const fetchWorkspaceDocuments = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await fetch(`/api/documents?workspaceId=${activeWorkspaceId}`);
      const data = await res.json();
      if (data.documents) {
        // Filter out documents already in this KB
        const availableDocs = data.documents.filter((doc: any) => doc.knowledgeBaseId !== id);
        setWorkspaceDocuments(availableDocs);
      }
    } catch (error) {
      console.error("Failed to fetch workspace documents", error);
    }
  };

  useEffect(() => {
    if (isAddExistingOpen) {
      fetchWorkspaceDocuments();
      setSelectedDocumentIds([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddExistingOpen, activeWorkspaceId]);

  const handleLinkDocuments = async () => {
    if (selectedDocumentIds.length === 0) return;
    setIsLinking(true);
    try {
      const res = await fetch(`/api/knowledge-bases/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: selectedDocumentIds })
      });
      if (!res.ok) throw new Error("Failed to link documents");
      
      toast.success(`${selectedDocumentIds.length} document(s) added to knowledge base`);
      setIsAddExistingOpen(false);
      fetchDocuments();
    } catch (error) {
      toast.error("Failed to add documents");
    } finally {
      setIsLinking(false);
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocumentIds(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p className="text-muted-foreground">Loading Knowledge Base...</p>
      </div>
    );
  }

  if (!kb) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto text-center h-full flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold font-heading">Knowledge Base not found</h1>
        <p className="text-muted-foreground mt-2 mb-6">The collection you're looking for doesn't exist or you don't have access.</p>
        <Button onClick={() => router.push('/knowledge-bases')} className="rounded-full">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push('/knowledge-bases')} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">{kb.name}</h1>
          <p className="text-muted-foreground mt-1">{kb.description || "No description provided."}</p>
        </div>
      </div>

      <div 
        onClick={() => fileInputRef.current?.click()}
        className="glass border-dashed border-2 border-border/50 rounded-2xl p-10 flex flex-col items-center justify-center text-center shrink-0 hover:bg-background/40 transition-colors cursor-pointer group"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange} 
          accept=".pdf,.docx,.txt,.md,.csv" 
        />
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
          {isUploading ? <Loader2 size={28} className="animate-spin" /> : <Upload size={28} />}
        </div>
        <h3 className="text-lg font-heading font-semibold">
          {isUploading ? "Uploading..." : `Upload to ${kb.name}`}
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Support for PDF, DOCX, PPTX, TXT, MD, CSV, JSON. Maximum file size 50MB.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading font-semibold">Documents in this collection</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              className="rounded-full text-sm h-9 shadow-sm shadow-primary/5"
              onClick={() => setIsAddExistingOpen(true)}
            >
              Add Existing
            </Button>
            <Button 
              variant="outline" 
              className="rounded-full text-sm h-9 shadow-sm shadow-primary/5"
              onClick={() => router.push(`/chat?knowledgeBaseId=${kb.id}`)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat with KB
            </Button>
          </div>
        </div>
        
        {documents.length === 0 ? (
          <div className="glass-panel p-8 text-center text-muted-foreground border border-border/50 rounded-2xl">
            No documents uploaded to this knowledge base yet. Upload a file above to get started.
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {documents.map((doc: any, i: number) => (
                <div key={doc.id || i} className="glass-panel p-4 flex flex-col gap-3 rounded-2xl border border-border/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FileText size={16} />
                      </div>
                      <div className="flex flex-col">
                        <Link href={`/documents/${doc.id}`} className="font-medium text-sm line-clamp-1 hover:text-primary hover:underline transition-colors">{doc.title}</Link>
                        <span className="text-xs text-muted-foreground">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB • {formatMimeType(doc.mimeType)}</span>
                      </div>
                    </div>
                    <MobileDrawer 
                      title={doc.title} 
                      description="Document Actions"
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                          <MoreVertical size={16} />
                        </Button>
                      }
                    >
                      <div className="flex flex-col gap-2">
                        <Button 
                          onClick={() => router.push(`/chat?documentId=${doc.id}&documentTitle=${encodeURIComponent(doc.title)}`)}
                          variant="outline" 
                          className="w-full justify-start h-12 rounded-xl"
                        >
                          <MessageSquare className="mr-2 h-4 w-4" /> Chat
                        </Button>
                        <Button 
                          onClick={() => deleteDocument(doc.id)}
                          variant="outline" 
                          className="w-full justify-start h-12 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </MobileDrawer>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      {doc.status === 'INDEXED' ? (
                        <span className="text-green-500 text-[10px] font-medium bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12} /> Indexed
                        </span>
                      ) : doc.status === 'UPLOADED' || doc.status === 'PROCESSING' ? (
                        <span className="text-amber-500 text-[10px] font-medium bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock size={12} className="animate-pulse" /> Processing
                        </span>
                      ) : (
                        <span className="text-destructive text-[10px] font-medium bg-destructive/10 px-2 py-0.5 rounded-full">Error</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block glass-panel overflow-x-auto border border-border/50 rounded-2xl">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                <thead className="bg-background/40 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Name</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Size</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                    <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {documents.map((doc: any, i: number) => (
                    <tr key={doc.id || i} className="hover:bg-background/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <FileText size={16} />
                          </div>
                          <Link href={`/documents/${doc.id}`} className="font-medium group-hover:text-primary transition-colors hover:underline">{doc.title}</Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground truncate max-w-[150px]">{formatMimeType(doc.mimeType)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {doc.status === 'INDEXED' ? (
                            <>
                              <CheckCircle2 size={14} className="text-green-500" />
                              <span className="text-green-500 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded-full">Indexed</span>
                            </>
                          ) : doc.status === 'UPLOADED' || doc.status === 'PROCESSING' ? (
                            <>
                              <Clock size={14} className="text-amber-500 animate-pulse" />
                              <span className="text-amber-500 text-xs font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">Processing</span>
                            </>
                          ) : (
                            <span className="text-destructive text-xs font-medium bg-destructive/10 px-2 py-0.5 rounded-full">Error</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            onClick={() => router.push(`/chat?documentId=${doc.id}&documentTitle=${encodeURIComponent(doc.title)}`)}
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            title="Chat with Document"
                          >
                            <MessageSquare size={16} />
                          </Button>
                          <Button 
                            onClick={() => deleteDocument(doc.id)}
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="Delete Document"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Dialog open={isAddExistingOpen} onOpenChange={setIsAddExistingOpen}>
        <DialogContent className="sm:max-w-[500px] glass max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Existing Document</DialogTitle>
            <DialogDescription>
              Select documents from your workspace to add to this knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4 min-h-[200px]">
            {workspaceDocuments.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No available documents found in the workspace.
              </div>
            ) : (
              <div className="space-y-2">
                {workspaceDocuments.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-background/40 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      checked={selectedDocumentIds.includes(doc.id)}
                      onChange={() => toggleDocumentSelection(doc.id)}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText size={16} className="text-primary shrink-0" />
                      <span className="font-medium text-sm truncate">{doc.title}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-4 pt-4 border-t border-border/50">
            <Button variant="outline" onClick={() => setIsAddExistingOpen(false)}>Cancel</Button>
            <Button onClick={handleLinkDocuments} disabled={selectedDocumentIds.length === 0 || isLinking}>
              {isLinking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isLinking ? "Adding..." : `Add ${selectedDocumentIds.length} Document(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
