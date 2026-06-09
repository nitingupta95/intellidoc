"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Paperclip, Send, BrainCircuit, Info, User, Loader2, Menu, Database, ChevronDown } from "lucide-react";
import { getKnowledgeBases } from "@/actions/knowledge-bases";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useConversationStore } from "@/store/conversation-store";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ChatContent() {
  const { messages, isGenerating, sendMessage, activeConversationId, conversations } = useConversationStore();
  const [input, setInput] = useState("");
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(true);
  const [kbs, setKbs] = useState<any[]>([]);
  const [selectedKb, setSelectedKb] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId");
  const documentTitle = searchParams.get("documentTitle");

  useEffect(() => {
    getKnowledgeBases().then(res => {
      if (res.success && res.data) setKbs(res.data);
    });
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    const userMsg = input;
    setInput("");
    
    if (documentId && !activeConversationId) {
      await sendMessage(userMsg, null, [documentId]);
    } else {
      await sendMessage(userMsg, selectedKb);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 bg-background/50">
      {isChatSidebarOpen && <ChatSidebar className="hidden md:flex" />}
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <header className="h-16 border-b border-border/50 flex items-center justify-between px-4 md:px-6 shrink-0 glass-panel">
          <div className="flex items-center gap-3">
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden mr-2">
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
              className="hidden md:flex mr-2 text-muted-foreground hover:bg-muted"
              onClick={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
            >
              <Menu size={20} />
            </Button>

            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <BrainCircuit size={20} />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-sm">IntelliDoc Assistant</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                Using GPT-4o with RAG
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {(() => {
              const activeConv = conversations.find(c => c.id === activeConversationId);
              const isExisting = !!activeConversationId;
              const displayKbId = isExisting ? (activeConv?.metadata?.knowledgeBaseId || null) : selectedKb;
              const displayDocIds = isExisting ? (activeConv?.metadata?.documentIds || null) : (documentId ? [documentId] : null);
              
              let label = "All Documents";
              if (displayDocIds && displayDocIds.length > 0) {
                 label = documentTitle ? `Doc: ${documentTitle}` : "Specific Document";
              } else {
                const displayKb = kbs.find(kb => kb.id === displayKbId);
                if (displayKb) label = displayKb.name;
              }

              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={isExisting}>
                    <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2 border-border/50 bg-background/50 text-xs text-muted-foreground hover:text-foreground">
                      <Database size={14} className="text-primary" />
                      <span className="truncate max-w-[150px]">{label}</span>
                      {!isExisting && <ChevronDown size={14} className="opacity-50" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setSelectedKb(null)} className={`cursor-pointer ${!selectedKb ? "bg-primary/10" : ""}`}>
                      <Database size={14} className="mr-2 opacity-50" />
                      All Documents
                    </DropdownMenuItem>
                    {kbs.map(kb => (
                      <DropdownMenuItem key={kb.id} onClick={() => setSelectedKb(kb.id)} className={`cursor-pointer ${selectedKb === kb.id ? "bg-primary/10" : ""}`}>
                        <Database size={14} className="mr-2 text-primary" />
                        {kb.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}

            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Info size={20} />
            </Button>
          </div>
        </header>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin">
          {messages.length === 0 ? (
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
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground shrink-0 mb-0.5 md:mb-1 h-10 w-10">
                <Paperclip size={20} />
              </Button>
              
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none min-h-[44px] max-h-[150px] md:max-h-[200px] py-3 px-2 text-[16px] md:text-sm leading-relaxed placeholder:text-muted-foreground scrollbar-thin outline-none"
                rows={1}
              />
              
              <Button 
                onClick={handleSend} 
                disabled={!input.trim() || isGenerating}
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

