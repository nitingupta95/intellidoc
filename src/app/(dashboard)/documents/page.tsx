"use client";

import { useState, useRef } from "react";
import { 
  FileText, 
  Upload, 
  Search, 
  MoreVertical, 
  Filter,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function DocumentsPage() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [isUploading, setIsUploading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kbs, setKbs] = useState<any[]>([]);
  const [selectedKb, setSelectedKb] = useState<string>("");

  useEffect(() => {
    if (activeWorkspaceId) {
      fetch(`/api/knowledge-bases?workspaceId=${activeWorkspaceId}`)
        .then(res => res.json())
        .then(data => {
          if (data.knowledgeBases) setKbs(data.knowledgeBases);
        })
        .catch(console.error);
    }
  }, [activeWorkspaceId]);

  const fetchDocuments = async (silent = false) => {
    if (!activeWorkspaceId) return;
    try {
      if (!silent) setLoadingDocs(true);
      const res = await fetch(`/api/documents?workspaceId=${activeWorkspaceId}`);
      const data = await res.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents", error);
    } finally {
      if (!silent) setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    // Check if any documents are currently processing
    const hasProcessingDocs = documents.some(doc => doc.status === 'UPLOADED' || doc.status === 'PROCESSING');
    
    if (!hasProcessingDocs) return;

    // Poll every 3 seconds
    const interval = setInterval(() => {
      fetchDocuments(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append("file", file);
      if (activeWorkspaceId) {
        formData.append("workspaceId", activeWorkspaceId);
      }
      if (selectedKb) {
        formData.append("knowledgeBaseId", selectedKb);
      }
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }
      
      // Refresh documents silently
      await fetchDocuments(true);
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Failed to upload document.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${documentToDelete}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDocuments(docs => docs.filter(doc => doc.id !== documentToDelete));
        toast.success("Document deleted successfully");
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      console.error("Failed to delete document", error);
      toast.error("Failed to delete document.");
    } finally {
      setIsDeleting(false);
      setDocumentToDelete(null);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">Manage and upload your knowledge base files.</p>
        </div>
        <Button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="font-medium rounded-full px-6 shadow-lg shadow-primary/20"
        >
          {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {isUploading ? "Uploading..." : "Upload Files"}
        </Button>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search documents by name, content, or tag..." 
            className="w-full pl-9 pr-4 py-2 glass bg-background/50 border border-border/50 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
        <div className="flex gap-2 items-center">
          {kbs.length > 0 && (
            <select 
              className="glass bg-background/50 border border-border/50 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={selectedKb}
              onChange={(e) => setSelectedKb(e.target.value)}
            >
              <option value="">Upload to Workspace (No KB)</option>
              {kbs.map((kb) => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
          )}
          <Button variant="outline" className="glass rounded-full text-sm font-medium">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Upload Zone */}
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
          {isUploading ? "Uploading..." : "Click or drag files to upload"}
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Support for PDF, DOCX, PPTX, TXT, MD, CSV, JSON. Maximum file size 50MB.
        </p>
      </div>

      {/* Document List */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pb-6">
        {loadingDocs ? (
          <div className="glass-panel p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="glass-panel p-8 text-center text-muted-foreground">
            No documents uploaded yet. Upload a file above to get started.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {documents.map((doc: any, i: number) => (
                <div key={doc.id || i} className="glass-panel p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FileText size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm line-clamp-1">{doc.title}</span>
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
                        <Button variant="outline" className="w-full justify-start h-12 rounded-xl">
                          <FileText className="mr-2 h-4 w-4" /> View Details
                        </Button>
                        <Button 
                          onClick={() => router.push(`/chat?documentId=${doc.id}&documentTitle=${encodeURIComponent(doc.title)}`)}
                          variant="outline" 
                          className="w-full justify-start h-12 rounded-xl"
                        >
                          <MessageSquare className="mr-2 h-4 w-4" /> Chat with Document
                        </Button>
                        <Button 
                          onClick={() => setDocumentToDelete(doc.id)}
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

            {/* Desktop Table View */}
            <div className="hidden md:block glass-panel overflow-x-auto border border-border/50">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
            <thead className="bg-background/40 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium text-muted-foreground">Name</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Size</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Uploaded By</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 font-medium text-muted-foreground">Uploaded</th>
                <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
              <tbody className="divide-y divide-border/50">
                {documents.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (doc: any, i: number) => (
                <tr key={doc.id || i} className="hover:bg-background/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <FileText size={16} />
                      </div>
                      <span className="font-medium group-hover:text-primary transition-colors">{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground truncate max-w-[150px]">{formatMimeType(doc.mimeType)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                  <td className="px-6 py-4 text-muted-foreground">{doc.user?.name || "Unknown"}</td>
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
                  <td className="px-6 py-4 text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</td>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <MoreVertical size={16} />
                      </Button>
                      <Button 
                        onClick={() => setDocumentToDelete(doc.id)}
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

      <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && !isDeleting && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your document and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); confirmDelete(); }} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  </div>
</div>
);
}
