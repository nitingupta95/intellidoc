"use client";

import { 
  Upload, 
  Search, 
  Filter,
  Loader2,
  Building2,
  ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useDocuments } from "@/hooks/use-documents";
import { UploadSection } from "@/components/documents/upload-section";
import { DocumentTable } from "@/components/documents/document-table";
import { DocumentCards } from "@/components/documents/document-cards";
import { DocumentDialogs } from "@/components/documents/document-dialogs";

export default function DocumentsPage() {
  const router = useRouter();
  const {
    activeWorkspaceId,
    isUploading,
    loadingDocs,
    documentToDelete,
    setDocumentToDelete,
    isDeleting,
    currentFolderId,
    setCurrentFolderId,
    isCreatingFolder,
    setIsCreatingFolder,
    newFolderName,
    setNewFolderName,
    fileInputRef,
    kbs,
    selectedKb,
    setSelectedKb,
    isDragOver,
    uploadQueue,
    displayedFolders,
    displayedDocuments,
    currentFolder,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileChange,
    confirmDelete,
    handleCreateFolder,
  } = useDocuments();

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

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">Manage and upload your knowledge base files.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsCreatingFolder(true)}
            variant="outline"
            disabled={!activeWorkspaceId}
            className="font-medium rounded-full shadow-sm"
            data-tour="new-folder"
          >
            New Folder
          </Button>
          <Button 
            onClick={() => {
              if (!activeWorkspaceId) {
                toast.error("Please select a workspace first");
                return;
              }
              fileInputRef.current?.click();
            }}
            disabled={isUploading || !activeWorkspaceId}
            className="font-medium rounded-full px-6 shadow-lg shadow-primary/20"
          >
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {isUploading ? "Uploading..." : "Upload Files"}
          </Button>
        </div>
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

      <UploadSection
        isUploading={isUploading}
        isDragOver={isDragOver}
        activeWorkspaceId={activeWorkspaceId}
        uploadQueue={uploadQueue}
        fileInputRef={fileInputRef}
        handleDrop={handleDrop}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleFileChange={handleFileChange}
      />

      {/* Document List */}
      <div className="pb-6">
        {loadingDocs ? (
          <div className="glass-panel p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading documents...
          </div>
        ) : !activeWorkspaceId ? (
          <div className="glass-panel p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-xl font-heading font-semibold mb-2">No Workspace Selected</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              You need to select or create a workspace before you can upload and manage documents.
            </p>
            <Button onClick={() => router.push('/settings/team')} className="rounded-full shadow-lg">
              Manage Workspaces
            </Button>
          </div>
        ) : displayedDocuments.length === 0 && displayedFolders.length === 0 ? (
          <div className="glass-panel p-8 text-center text-muted-foreground">
            {currentFolderId ? "This folder is empty. Upload a file here." : "No documents uploaded yet. Upload a file or create a folder above to get started."}
          </div>
        ) : (
          <>
            {/* Breadcrumbs */}
            {currentFolderId && (
              <div className="flex items-center gap-2 mb-4 text-sm">
                <Button variant="ghost" size="sm" onClick={() => setCurrentFolderId(currentFolder?.parentId || null)} className="h-8 px-2">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <span className="text-muted-foreground">{currentFolder?.name}</span>
              </div>
            )}
            
            <DocumentCards
              displayedFolders={displayedFolders}
              displayedDocuments={displayedDocuments}
              setCurrentFolderId={setCurrentFolderId}
              setDocumentToDelete={setDocumentToDelete}
              formatMimeType={formatMimeType}
              router={router}
            />

            <DocumentTable
              displayedFolders={displayedFolders}
              displayedDocuments={displayedDocuments}
              setCurrentFolderId={setCurrentFolderId}
              setDocumentToDelete={setDocumentToDelete}
              formatMimeType={formatMimeType}
              router={router}
            />
          </>
        )}
      </div>

      <DocumentDialogs
        documentToDelete={documentToDelete}
        setDocumentToDelete={setDocumentToDelete}
        confirmDelete={confirmDelete}
        isDeleting={isDeleting}
        isCreatingFolder={isCreatingFolder}
        setIsCreatingFolder={setIsCreatingFolder}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleCreateFolder={handleCreateFolder}
      />
    </div>
  );
}
