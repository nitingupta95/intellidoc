"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useWorkspaceStore } from "@/store/workspace-store";
import { UploadQueueItem } from "@/components/documents/upload-section";

export function useDocuments() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const [isUploading, setIsUploading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Folder states
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [folders, setFolders] = useState<any[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kbs, setKbs] = useState<any[]>([]);
  const [selectedKb, setSelectedKb] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

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
      if (data.documents) setDocuments(data.documents);
    } catch (error) {
      console.error("Failed to fetch documents", error);
    } finally {
      if (!silent) setLoadingDocs(false);
    }
  };

  const fetchFolders = async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await fetch(`/api/folders?workspaceId=${activeWorkspaceId}`);
      const data = await res.json();
      if (Array.isArray(data)) setFolders(data);
    } catch (error) {
      console.error("Failed to fetch folders", error);
    }
  };

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchDocuments();
      fetchFolders();
    } else {
      setDocuments([]);
      setFolders([]);
      setLoadingDocs(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const hasProcessingDocs = documents.some(doc => doc.status === 'UPLOADED' || doc.status === 'PROCESSING');
    if (!hasProcessingDocs) return;

    const interval = setInterval(() => {
      fetchDocuments(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  const uploadFiles = async (files: File[]) => {
    if (!files.length || !activeWorkspaceId) return;

    const queue = files.map(f => ({ name: f.name, progress: 0, status: 'pending' as const }));
    setUploadQueue(queue);
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading', progress: 20 } : q));
      try {
        const file = files[i];

        // 1. Get Presigned URL
        const presignRes = await fetch("/api/upload", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
            workspaceId: activeWorkspaceId,
            knowledgeBaseId: selectedKb || undefined,
            folderId: currentFolderId || undefined
          })
        });

        if (!presignRes.ok) {
          const errData = await presignRes.json();
          throw new Error(errData.error || "Failed to initialize upload");
        }

        const { presignedUrl, documentId } = await presignRes.json();
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: 50 } : q));

        // 2. Upload file directly to S3 via Presigned URL
        const uploadRes = await fetch(presignedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream"
          },
          body: file
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload to storage provider");
        }

        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: 80 } : q));

        // 3. Complete the upload and trigger processing
        const completeRes = await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId })
        });

        if (!completeRes.ok) {
          throw new Error("Failed to complete upload process");
        }

        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done', progress: 100 } : q));
      } catch (error: any) {
        console.error(error);
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', progress: 0 } : q));
        toast.error(`Failed to upload ${files[i].name}: ${error.message || "Unknown error"}`);
      }
    }

    await fetchDocuments(true);
    setIsUploading(false);
    setTimeout(() => setUploadQueue([]), 3000);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!activeWorkspaceId) {
      toast.error("Please select a workspace first");
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/documents/${documentToDelete}`, { method: 'DELETE' });
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

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !activeWorkspaceId) return;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          workspaceId: activeWorkspaceId,
          parentId: currentFolderId || undefined
        })
      });
      if (res.ok) {
        toast.success("Folder created");
        setNewFolderName("");
        setIsCreatingFolder(false);
        fetchFolders();
      } else {
        throw new Error("Failed to create folder");
      }
    } catch (error) {
      toast.error("Failed to create folder");
    }
  };

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const displayedFolders = folders.filter(f => f.parentId === currentFolderId);
  const displayedDocuments = documents.filter(doc => doc.folderId === currentFolderId || (!doc.folderId && !currentFolderId));

  return {
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
  };
}
