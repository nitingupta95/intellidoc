"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, BrainCircuit, Info, User, Loader2, Menu, Database, ChevronDown, Download, FileText, FileDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConversationStore } from "@/store/conversation-store";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { useWorkspaceStore } from "@/store/workspace-store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportAsMarkdown, exportAsPdf } from "@/lib/export-chat";

function ChatContent() {
  const { messages, isGenerating, sendMessage, activeConversationId, conversations, setActiveConversation } = useConversationStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [input, setInput] = useState("");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(true);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [kbs, setKbs] = useState<any[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("");
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
  // so we start a fresh chat instead of appending to a previous one.
  useEffect(() => {
    if (docId) {
      setActiveConversation(null);
      // Fetch document details for summary and suggested questions
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
    } catch (e) {
      toast.error("Could not generate share link.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="h-full flex overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 bg-background/50">
      {isChatSidebarOpen && <ChatSidebar className="hidden lg:flex" />}
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <header className="relative z-50 h-16 border-b border-border/50 flex items-center justify-between px-4 md:px-6 shrink-0 glass-panel gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden mr-2 shrink-0">
                  <Menu size={20} />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="h-[80vh] p-0">
                <ChatSidebar />
              </DrawerContent>
            </Drawer>

            <Button 
              variant="ghost" 
              size="icon" 
              className="hidden lg:flex mr-2 text-muted-foreground hover:bg-muted shrink-0"
              onClick={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
            >
              <Menu size={20} />
            </Button>

            <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0 hidden sm:flex">
              <BrainCircuit size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-semibold text-sm truncate">IntelliDoc Assistant</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block shrink-0"></span>
                <span className="truncate">Using GPT-4o with RAG</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {kbs.length > 0 && (
              <select 
                className="flex glass bg-background/50 border border-border/50 rounded-full px-2 sm:px-3 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 max-w-[120px] sm:max-w-[200px]"
                value={currentKbId || ""}
                onChange={(e) => setSelectedKbId(e.target.value)}
                disabled={!!activeConversationId} // Lock to conversation's KB once created
              >
                <option value="">All Workspace Documents</option>
                {kbs.map((kb) => (
                  <option key={kb.id} value={kb.id}>{kb.name}</option>
                ))}
              </select>
            )}

            {/* Share and Export */}
            {activeConversationId && messages.length > 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground" 
                title="Share Chat"
                onClick={handleShare}
                disabled={isSharing}
              >
                {isSharing ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
              </Button>
            )}

            {/* Export dropdown */}
            {messages.length > 0 && (
              <div className="relative group">
                <Button variant="ghost" size="icon" className="text-muted-foreground" title="Export Chat">
                  <Download size={20} />
                </Button>
                <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border/50 rounded-xl p-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                  <button
                    onClick={() => exportAsMarkdown(messages, activeConversation?.title || 'IntelliDoc Chat')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <FileText size={14} /> Export as Markdown
                  </button>
                  <button
                    onClick={() => exportAsPdf(messages, activeConversation?.title || 'IntelliDoc Chat')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <FileDown size={14} /> Export as PDF
                  </button>
                </div>
              </div>
            )}

            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Info size={20} />
            </Button>
          </div>
        </header>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
          {hasKey === false ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-md mx-auto mt-10">
              <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-4">
                <Info size={32} />
              </div>
              <h2 className="text-2xl font-heading font-semibold">API Key Required</h2>
              <p className="text-muted-foreground text-sm">
                You must provide an OpenAI or Gemini API Key to use the IntelliDoc Assistant. 
                Please upload your API key in the settings tab to continue.
              </p>

              <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20 text-left w-full">
                <h3 className="font-semibold text-primary text-sm mb-1">Need a free API key?</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  You can get a free Gemini API key from Google AI Studio. 
                  (Admin: Update this link if you want to provide your own API keys)
                </p>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full text-xs h-8">Get Free Gemini Key</Button>
                </a>
              </div>
              
              <div className="mt-6 w-full">
                <Link href="/settings">
                  <Button className="w-full">
                    Go to Settings
                  </Button>
                </Link>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center py-10 md:py-20 text-center space-y-6 max-w-md mx-auto min-h-full">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shrink-0">
                <MessageSquare size={32} />
              </div>
              <h2 className="text-2xl font-heading font-semibold">
                {docTitle ? `Chat with ${docTitle}` : "How can I help you today?"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {docTitle 
                  ? docDetails?.summary || "Ask me anything about this document. I'll search through it and provide cited answers."
                  : "Select a document from the dropdown above, or ask a general question. If you haven't uploaded any PDFs yet, head over to the Documents section."}
              </p>
              
              {!docTitle && (
                <div className="flex gap-4 mt-2">
                  <Link href="/documents">
                    <Button variant="outline" className="text-sm">Upload a PDF Document</Button>
                  </Link>
                </div>
              )}
              
              <div className="grid grid-cols-1 w-full gap-3 mt-8">
                {docDetails?.suggestedQuestions && docDetails.suggestedQuestions.length > 0 ? (
                  docDetails.suggestedQuestions.map((q: string, i: number) => (
                    <SuggestionButton key={i} text={q} onClick={(t) => setInput(t)} />
                  ))
                ) : (
                  <>
                    <SuggestionButton text="Summarize the key points" onClick={(t) => setInput(t)} />
                    <SuggestionButton text="What are the main takeaways?" onClick={(t) => setInput(t)} />
                    <SuggestionButton text="Extract important entities and dates" onClick={(t) => setInput(t)} />
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((msg: any, idx: number) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1 border border-primary/30">
                      <BrainCircuit size={16} className="text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl p-4 ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground ml-auto' 
                      : 'glass bg-background/50 border border-border/50'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-muted/80 prose-pre:border prose-pre:border-border/50 prose-pre:rounded-xl prose-a:text-primary prose-strong:text-foreground text-sm leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                    )}
                    
                    {/* Citations block */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs font-semibold mb-2 flex items-center gap-1 opacity-70">
                          <Info size={12} /> Sources:
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                          {msg.citations.map((cit: any, i: number) => (
                            <div key={i} className="px-3 py-1.5 rounded-lg bg-background/50 border border-border text-[10px] shrink-0 max-w-[200px]">
                              <span className="font-bold block truncate text-primary">Doc • {(cit.score * 100).toFixed(1)}% match</span>
                              <span className="truncate block opacity-70">{cit.text_snippet}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.isStreaming && isGenerating && idx === messages.length - 1 && (
                      <span className="inline-flex items-center gap-1 mt-2 text-primary opacity-70">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                      <User size={16} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input Area */}
        <div className="p-3 md:p-4 border-t border-border/50 glass-panel shrink-0 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-4">
          <div className="max-w-4xl mx-auto relative">
            <div className="bg-background/80 rounded-2xl border border-border/50 flex items-end p-1.5 md:p-2 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all shadow-sm">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasKey === false ? "Please add an API key first..." : "Ask a question..."}
                disabled={hasKey === false}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none min-h-[44px] max-h-[150px] md:max-h-[200px] py-3 px-2 text-[16px] md:text-sm leading-relaxed placeholder:text-muted-foreground scrollbar-thin outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
              />
              
              <Button 
                onClick={handleSend} 
                disabled={!input.trim() || isGenerating || hasKey === false}
                size="icon" 
                className="rounded-full shrink-0 mb-0.5 md:mb-1 h-10 w-10 transition-transform active:scale-95"
              >
                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-1" />}
              </Button>
            </div>
            <div className="text-center mt-2 md:mt-3 text-[10px] md:text-xs text-muted-foreground hidden sm:block">
              IntelliDoc AI can make mistakes. Verify important information using the provided citations.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestionButton({ text, onClick }: { text: string, onClick: (t: string) => void }) {
  return (
    <button 
      onClick={() => onClick(text)}
      className="text-left px-4 py-3 rounded-xl border border-border/50 bg-background/30 hover:bg-muted hover:border-primary/30 transition-all text-sm font-medium text-muted-foreground hover:text-foreground w-full h-auto whitespace-normal break-words"
    >
      &quot;{text}&quot;
    </button>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}

