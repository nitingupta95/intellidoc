"use client";

import { 
  BrainCircuit, 
  Info, 
  Loader2, 
  Menu, 
  Download, 
  FileText, 
  FileDown, 
  Share2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Suspense } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { exportAsMarkdown, exportAsPdf } from "@/lib/export-chat";

function ChatContent() {
  const {
    messages,
    isGenerating,
    activeConversationId,
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
    docTitle,
    activeConversation,
    currentKbId,
    handleSend,
    handleKeyDown,
    handleShare,
  } = useChat();

  return (
    <div className="h-full flex overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 bg-background/50">
      {isChatSidebarOpen && <ChatSidebar className="hidden lg:flex" />}
      
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Chat Header */}
        <header className="absolute top-0 left-0 right-0 z-50 h-16 bg-background/40 backdrop-blur-md border-b border-white/10 dark:border-white/5 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm transition-all duration-300">
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
                disabled={!!activeConversationId}
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-20 md:pt-24 space-y-6 scrollbar-thin">
          <ChatMessages
            messages={messages}
            isGenerating={isGenerating}
            hasKey={hasKey}
            messagesEndRef={messagesEndRef}
            docTitle={docTitle}
            docDetails={docDetails}
            setInput={setInput}
          />
        </div>

        {/* Floating Chat Input Area */}
        <ChatInput
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          handleKeyDown={handleKeyDown}
          isGenerating={isGenerating}
          hasKey={hasKey}
        />
      </div>
    </div>
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
