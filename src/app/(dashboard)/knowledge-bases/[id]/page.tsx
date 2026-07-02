"use client";

import { useRouter } from "next/navigation";
import { Upload, Loader2, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKbDetails } from "@/hooks/use-kb-details";
import { KbDocumentsTable } from "@/components/knowledge-bases/kb-documents-table";
import { KbDocumentsCards } from "@/components/knowledge-bases/kb-documents-cards";
import { AddExistingDialog } from "@/components/knowledge-bases/add-existing-dialog";
import { Input } from "@/components/ui/input";

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
    <div className="h-full flex flex-col space-y-10">
      <div className="glass-panel rounded-3xl border border-border/50 p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full mt-1"
              onClick={() => router.push("/knowledge-bases")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div>
              <h1 className="text-4xl font-heading font-bold">
                {kb.name}
              </h1>

              <p className="text-muted-foreground mt-2 max-w-xl">
                {kb.description || "No description provided."}
              </p>

              <div className="flex flex-wrap gap-6 mt-6">

                <div>
                  <p className="text-2xl font-bold">
                    {documents.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Documents
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-bold text-green-500">
                    {
                      documents.filter(
                        d => d.status === "INDEXED"
                      ).length
                    }
                  </p>

                  <p className="text-sm text-muted-foreground">
                    AI Ready
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-bold">
                    {(
                      documents.reduce(
                        (a, b) => a + (b.fileSize || 0),
                        0
                      ) /
                      1024 /
                      1024
                    ).toFixed(2)}
                    MB
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Storage
                  </p>
                </div>

              </div>

            </div>
          </div>

          <div className="flex gap-3">

            <Button
              onClick={() =>
                router.push(`/chat?knowledgeBaseId=${kb.id}`)
              }
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat KB
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsAddExistingOpen(true)}
            >
              Add Existing
            </Button>

          </div>

        </div>
      </div>
     

      {/* <div 
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
      </div> */}

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pb-6">
         

        {documents.length === 0 ? (
          <div className="glass-panel p-8 text-center text-muted-foreground border border-border/50 rounded-2xl">
            No documents uploaded to this knowledge base yet. Upload a file in document section and click on add existing button to add documents to this knowledge base.
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
