"use client";

import { useRouter } from "next/navigation";
import { Upload, Loader2, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKbDetails } from "@/hooks/use-kb-details";
import { KbDocumentsTable } from "@/components/knowledge-bases/kb-documents-table";
import { KbDocumentsCards } from "@/components/knowledge-bases/kb-documents-cards";
import { AddExistingDialog } from "@/components/knowledge-bases/add-existing-dialog";

export default function KnowledgeBaseDetailPage() {
  const router = useRouter();
  const {
    kb,
    documents,
    loading,
    isUploading,
    fileInputRef,
    isAddExistingOpen,
    setIsAddExistingOpen,
    workspaceDocuments,
    selectedDocumentIds,
    isLinking,
    handleFileChange,
    deleteDocument,
    handleLinkDocuments,
    toggleDocumentSelection,
  } = useKbDetails();

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
            <KbDocumentsCards
              documents={documents}
              deleteDocument={deleteDocument}
              formatMimeType={formatMimeType}
              router={router}
            />

            <KbDocumentsTable
              documents={documents}
              deleteDocument={deleteDocument}
              formatMimeType={formatMimeType}
              router={router}
            />
          </>
        )}
      </div>

      <AddExistingDialog
        isAddExistingOpen={isAddExistingOpen}
        setIsAddExistingOpen={setIsAddExistingOpen}
        workspaceDocuments={workspaceDocuments}
        selectedDocumentIds={selectedDocumentIds}
        toggleDocumentSelection={toggleDocumentSelection}
        handleLinkDocuments={handleLinkDocuments}
        isLinking={isLinking}
      />
    </div>
  );
}
