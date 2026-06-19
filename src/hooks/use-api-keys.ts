"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export function useApiKeys() {
  const [openApiKey, setOpenApiKey] = useState("");
  const [maskedOpenApiKey, setMaskedOpenApiKey] = useState<string | null>(null);
  
  const [geminiKey, setGeminiKey] = useState("");
  const [maskedGeminiKey, setMaskedGeminiKey] = useState<string | null>(null);
  const [isSystemGeminiKey, setIsSystemGeminiKey] = useState(false);
  
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [isOpenAiKeySaving, setIsOpenAiKeySaving] = useState(false);
  const [isGeminiKeySaving, setIsGeminiKeySaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/key")
      .then(res => res.json())
      .then(data => {
        if (data.hasOpenAIKey) setMaskedOpenApiKey(data.maskedOpenAIKey);
        if (data.hasGeminiKey) {
          setMaskedGeminiKey(data.maskedGeminiKey);
          setIsSystemGeminiKey(data.isSystemGeminiKey);
        }
        setIsKeyLoading(false);
      })
      .catch(() => setIsKeyLoading(false));
  }, []);

  const handleSaveOpenApiKey = async () => {
    if (!openApiKey) return;
    setIsOpenAiKeySaving(true);
    try {
      const res = await fetch("/api/user/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiKey: openApiKey })
      });
      const data = await res.json();
      if (data.success) {
        setMaskedOpenApiKey(openApiKey.length > 8 ? `sk-...${openApiKey.slice(-4)}` : "sk-...****");
        setOpenApiKey("");
        toast.success("OpenAI API Key saved successfully");
      } else {
        toast.error(data.error || "Failed to save OpenAI API Key");
      }
    } catch (error: any) {
      toast.error("Failed to save OpenAI API Key: " + (error.message || "Unknown error"));
    } finally {
      setIsOpenAiKeySaving(false);
    }
  };

  const handleRevokeOpenApiKey = async () => {
    setIsOpenAiKeySaving(true);
    try {
      const res = await fetch("/api/user/key", { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "openai" })
      });
      const data = await res.json();
      if (data.success) {
        setMaskedOpenApiKey(null);
        toast.success("OpenAI API Key revoked");
      } else {
        toast.error(data.error || "Failed to revoke OpenAI API Key");
      }
    } catch (error: any) {
      toast.error("Failed to revoke OpenAI API Key: " + (error.message || "Unknown error"));
    } finally {
      setIsOpenAiKeySaving(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!geminiKey) return;
    setIsGeminiKeySaving(true);
    try {
      const res = await fetch("/api/user/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiKey })
      });
      const data = await res.json();
      if (data.success) {
        setMaskedGeminiKey(geminiKey.length > 8 ? `...${geminiKey.slice(-4)}` : "...****");
        setIsSystemGeminiKey(false);
        setGeminiKey("");
        toast.success("Gemini API Key saved successfully");
      } else {
        toast.error(data.error || "Failed to save Gemini API Key");
      }
    } catch (error: any) {
      toast.error("Failed to save Gemini API Key: " + (error.message || "Unknown error"));
    } finally {
      setIsGeminiKeySaving(false);
    }
  };

  const handleRevokeGeminiKey = async () => {
    setIsGeminiKeySaving(true);
    try {
      const res = await fetch("/api/user/key", { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "gemini" })
      });
      const data = await res.json();
      if (data.success) {
        const keyRes = await fetch("/api/user/key");
        const keyData = await keyRes.json();
        if (keyData.hasGeminiKey) {
          setMaskedGeminiKey(keyData.maskedGeminiKey);
          setIsSystemGeminiKey(keyData.isSystemGeminiKey);
        } else {
          setMaskedGeminiKey(null);
          setIsSystemGeminiKey(false);
        }
        toast.success("Gemini API Key revoked");
      } else {
        toast.error(data.error || "Failed to revoke Gemini API Key");
      }
    } catch (error: any) {
      toast.error("Failed to revoke Gemini API Key: " + (error.message || "Unknown error"));
    } finally {
      setIsGeminiKeySaving(false);
    }
  };

  return {
    openApiKey,
    setOpenApiKey,
    maskedOpenApiKey,
    isOpenAiKeySaving,
    geminiKey,
    setGeminiKey,
    maskedGeminiKey,
    isSystemGeminiKey,
    isGeminiKeySaving,
    isKeyLoading,
    handleSaveOpenApiKey,
    handleRevokeOpenApiKey,
    handleSaveGeminiKey,
    handleRevokeGeminiKey,
  };
}
