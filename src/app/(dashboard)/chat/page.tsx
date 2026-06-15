"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, BrainCircuit, Info, User, Loader2, Menu, Database, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConversationStore } from "@/store/conversation-store";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { useWorkspaceStore } from "@/store/workspace-store";

function ChatContent() {
  const { messages, isGenerating, sendMessage, activeConversationId, conversations } = useConversationStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const [input, setInput] = useState("");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(true);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [kbs, setKbs] = useState<any[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>("");
  
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

  const handleSend = async () => {
    if (!input.trim() || isGenerating || !activeWorkspaceId) return;
    const userMsg = input;
    setInput("");
    
    const docId = searchParams?.get("documentId") || undefined;
    await sendMessage(userMsg, activeWorkspaceId, currentKbId || undefined, docId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 bg-background/50">
      {isChatSidebarOpen && <ChatSidebar className="hidden lg:flex" />}
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <header className="h-16 border-b border-border/50 flex items-center justify-between px-4 md:px-6 shrink-0 glass-panel gap-2">
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
              
              <div className="mt-8">
                <Link href="/settings">
                  <Button className="w-full">
                    Go to Settings
                  </Button>
                </Link>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-md mx-auto mt-10">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                <MessageSquare size={32} />
              </div>
              <h2 className="text-2xl font-heading font-semibold">How can I help you today?</h2>
              <p className="text-muted-foreground text-sm">
                Ask me anything about your uploaded documents. I&apos;ll search through the knowledge base and provide cited answers.
              </p>
              
              <div className="grid grid-cols-1 w-full gap-3 mt-8">
                <SuggestionButton text="Summarize the Q3 Financial Report" onClick={(t) => setInput(t)} />
                <SuggestionButton text="What are our remote work policies?" onClick={(t) => setInput(t)} />
                <SuggestionButton text="Extract key entities from Project Alpha" onClick={(t) => setInput(t)} />
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
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                    
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
      className="text-left px-4 py-3 rounded-xl border border-border/50 bg-background/30 hover:bg-muted hover:border-primary/30 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
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

