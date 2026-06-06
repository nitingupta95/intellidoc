"use client";

import { useEffect, useState } from "react";
import { useConversationStore } from "@/store/conversation-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquarePlus, Search, MoreVertical, Trash2, Edit2, Pin, Archive, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ChatSidebar({ className }: { className?: string }) {
  const { 
    conversations, 
    activeConversationId, 
    setActiveConversation, 
    loadConversations, 
    createConversation,
    deleteConversation,
    renameConversation,
    isLoading
  } = useConversationStore();
  
  const [search, setSearch] = useState("");
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewChat = async () => {
    setActiveConversation(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      await deleteConversation(id);
    }
  };

  const handleRenameStart = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setIsRenaming(id);
    setRenameValue(currentTitle);
  };

  const handleRenameSubmit = async (e: React.KeyboardEvent | React.FocusEvent, id: string) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.stopPropagation();
    if (renameValue.trim()) {
      await renameConversation(id, renameValue.trim());
    }
    setIsRenaming(null);
  };

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) || 
    c.messages?.[0]?.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`w-72 flex-shrink-0 border-r border-border/50 bg-background/50 h-full flex flex-col ${className || ""}`}>
      <div className="p-4 flex flex-col gap-4 border-b border-border/50">
        <Button onClick={handleNewChat} className="w-full justify-start gap-2" variant="default">
          <MessageSquarePlus size={18} />
          New Chat
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            className="pl-9 bg-background/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-sm">Loading chats...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-10">
            No conversations found
          </div>
        ) : (
          filteredConversations.map(conv => (
            <div 
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                activeConversationId === conv.id 
                  ? "bg-primary/10 border border-primary/20" 
                  : "hover:bg-accent/50 border border-transparent"
              }`}
            >
              <div className="flex-1 min-w-0 mr-2">
                {isRenaming === conv.id ? (
                  <Input 
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => handleRenameSubmit(e, conv.id)}
                    onBlur={(e) => handleRenameSubmit(e, conv.id)}
                    autoFocus
                    className="h-7 text-sm px-2"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="font-medium text-sm truncate">{conv.title}</div>
                )}
                <div className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-1">
                  <span>{formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}</span>
                  {conv.messages?.[0] && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-border inline-block" />
                      <span className="truncate">{conv.messages[0].content}</span>
                    </>
                  )}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <MoreVertical size={16} className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => handleRenameStart(e as any, conv.id, conv.title)}>
                    <Edit2 size={14} className="mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => handleDelete(e as any, conv.id)} className="text-destructive focus:text-destructive">
                    <Trash2 size={14} className="mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
