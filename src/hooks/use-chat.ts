"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useConversationStore } from "@/store/conversation-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export function useChat() {
  const { 
    messages, 
    isGenerating, 
    sendMessage, 
    activeConversationId, 
    conversations, 
    setActiveConversation 
  } = useConversationStore();
  
  const { activeWorkspaceId } = useWorkspaceStore();
  const [input, setInput] = useState("");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(true);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kbs, setKbs] = useState<any[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [docDetails, setDocDetails] = useState<any>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  const docId = searchParams?.get("documentId") || undefined;
  const docTitle = searchParams?.get("documentTitle") || undefined;
  
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const currentKbId = activeConversation?.knowledgeBaseId || selectedKbId;

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

  useEffect(() => {
    fetch("/api/user/key")
      .then(res => res.json())
      .then(data => {
        setHasKey(data.hasOpenAIKey || data.hasGeminiKey);
      })
      .catch(() => setHasKey(false));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // When navigating to a specific document, clear the active conversation
  useEffect(() => {
    if (docId) {
      setActiveConversation(null);
      fetch(`/api/documents/${docId}`)
        .then(res => res.json())
        .then(data => {
          if (data.document) setDocDetails(data.document);
        })
        .catch(console.error);
    } else {
      setDocDetails(null);
    }
  }, [docId, setActiveConversation]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating || !activeWorkspaceId) return;
    const userMsg = input;
    setInput("");
    await sendMessage(userMsg, activeWorkspaceId, currentKbId || undefined, docId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShare = async () => {
    if (!activeConversationId || !activeWorkspaceId) return;
    setIsSharing(true);
    try {
      const res = await fetch("/api/shared-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: activeConversationId,
          resourceType: "CONVERSATION",
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
    } catch {
      toast.error("Could not generate share link.");
    } finally {
      setIsSharing(false);
    }
  };

  return {
    messages,
    isGenerating,
    activeConversationId,
    conversations,
    activeWorkspaceId,
    input,
    setInput,
    isChatSidebarOpen,
    setIsChatSidebarOpen,
    hasKey,
    messagesEndRef,
    kbs,
    selectedKbId,
    setSelectedKbId,
    docDetails,
    isSharing,
    docId,
    docTitle,
    activeConversation,
    currentKbId,
    handleSend,
    handleKeyDown,
    handleShare,
  };
}
