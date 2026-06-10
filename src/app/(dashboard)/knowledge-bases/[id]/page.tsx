"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { FolderGit2, ArrowLeft, Database, Loader2, FileText, Trash2, Plus, UploadCloud, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getKnowledgeBase, removeDocumentFromKnowledgeBase, addDocumentToKnowledgeBase } from "@/actions/knowledge-bases";
import { getDocuments } from "@/actions/documents";
import Link from "next/link";
import { formatBytes } from "@/lib/utils";

export default function KnowledgeBaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [removingDocId, setRemovingDocId] = useState<string | null>(null);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal for adding existing docs
  const [showAddModal, setShowAddModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [availableDocs, setAvailableDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [addingDocId, setAddingDocId] = useState<string | null>(null);

  useEffect(() => {
    if (kbId) {
      fetchKb();
    }
  }, [kbId]);

  const fetchKb = async () => {
    setLoading(true);
    const res = await getKnowledgeBase(kbId);
    if (res.success && res.data) {
      setKb(res.data);
    } else {
      router.push("/knowledge-bases");
    }
    setLoading(false);
  };

  const fetchAvailableDocs = async () => {
    setLoadingDocs(true);
    const res = await getDocuments();
    if (res.success && res.data) {
      const unassigned = res.data.filter((d: any) => d.knowledgeBaseId !== kbId);
      setAvailableDocs(unassigned);
    }
    setLoadingDocs(false);
  };

  const handleRemoveDoc = async (docId: string) => {
    if (!confirm("Remove this document from the knowledge base? It will not be deleted from your account.")) return;
    setRemovingDocId(docId);
    const res = await removeDocumentFromKnowledgeBase(docId);
    if (res.success) {
      fetchKb();
    } else {
      alert("Failed to remove document");
    }
    setRemovingDocId(null);
  };

  const handleAddDoc = async (docId: string) => {
    setAddingDocId(docId);
    const res = await addDocumentToKnowledgeBase(docId, kbId);
    if (res.success) {
      fetchKb();
      setShowAddModal(false);
    } else {
      alert("Failed to add document");
    }
    setAddingDocId(null);
  };

  const openAddModal = () => {
    fetchAvailableDocs();
    setShowAddModal(true);
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("knowledgeBaseId", kbId);
      
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }
      
      await fetchKb();
      if (showAddModal) setShowAddModal(false);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload document directly to knowledge base.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!kb) return null;

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/knowledge-bases">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 border border-border/50 bg-background/50 hover:bg-muted">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Database size={18} className="text-primary" />
              <h1 className="text-2xl font-heading font-bold tracking-tight">{kb.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{kb.description || "No description provided."}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange} 
            accept=".pdf,.docx,.txt,.md,.csv" 
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isUploading}
            variant="default" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {isUploading ? "Uploading..." : "Upload New Document"}
          </Button>
          <Button onClick={openAddModal} variant="outline" className="border-border/50 glass hover:bg-primary/10 hover:text-primary transition-colors">
            <Plus className="mr-2 h-4 w-4" /> Add Existing
          </Button>
        </div>
      </header>

      <div className="glass-panel border border-border/50 flex-1 min-h-0 flex flex-col overflow-hidden relative">
        <div className="p-6 border-b border-border/50 flex justify-between items-center bg-background/50">
          <div>
            <h2 className="text-lg font-heading font-semibold">Documents</h2>
            <p className="text-sm text-muted-foreground">Documents currently available in this knowledge base.</p>
          </div>
          <div className="flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <FolderGit2 size={14} className="mr-1.5" />
            {kb.documents?.length || 0} Total
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!kb.documents || kb.documents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText size={24} className="opacity-50" />
              </div>
              <p className="mb-6">This knowledge base is empty. Add documents to start querying against them.</p>
              <div className="flex gap-4">
                <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload Document
                </Button>
                <Button variant="outline" onClick={openAddModal}>
                  <Plus className="mr-2 h-4 w-4" /> Link Existing
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kb.documents.map((doc: any) => (
                <div key={doc.id} className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col hover:border-primary/30 transition-colors group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <FileText size={18} />
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveDoc(doc.id)}
                      disabled={removingDocId === doc.id}
                      title="Remove from knowledge base"
                    >
                      {removingDocId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </Button>
                  </div>
                  <h3 className="font-medium text-sm line-clamp-2 mb-1" title={doc.title || doc.filename}>{doc.title || doc.filename}</h3>
                  <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[120px]">{doc.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                    <span>{doc.fileSize ? formatBytes(doc.fileSize) : "Unknown size"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Document Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel border border-border/50 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border/50 flex justify-between items-center bg-background/80">
              <div>
                <h3 className="text-xl font-heading font-semibold">Add Documents</h3>
                <p className="text-sm text-muted-foreground">Select documents from your account to add to this knowledge base.</p>
              </div>
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>Close</Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDocs ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Loading available documents...</p>
                </div>
              ) : availableDocs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">No available documents found.</p>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />} Upload New Document
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title || doc.filename}</p>
                          <p className="text-xs text-muted-foreground">{doc.knowledgeBaseId ? "In another base" : "Unassigned"}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleAddDoc(doc.id)}
                        disabled={addingDocId === doc.id}
                      >
                        {addingDocId === doc.id ? <Loader2 size={14} className="animate-spin" /> : "Add"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
