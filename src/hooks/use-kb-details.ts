"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "sonner";

export function useKbDetails() {
  const params = useParams();
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [workspaceDocuments, setWorkspaceDocuments] = useState<any[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [isLinking, setIsLinking] = useState(false);

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
    if (!activeWorkspaceId || !id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch KB details
        const kbRes = await fetch(`/api/knowledge-bases?workspaceId=${activeWorkspaceId}`);
        const kbData = await kbRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return {
    id,
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
  };
}
