"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Database, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWorkspaceStore } from "@/store/workspace-store";
import { formatDistanceToNow } from "date-fns";

type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count?: { documents: number };
};

export default function KnowledgeBasesPage() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    
    setIsLoading(true);
    fetch(`/api/knowledge-bases?workspaceId=${activeWorkspaceId}`)
      .then(res => res.json())
      .then(data => {
        if (data.knowledgeBases) {
          setKbs(data.knowledgeBases);
        }
      })
      .finally(() => setIsLoading(false));
  }, [activeWorkspaceId]);

  const handleCreate = async () => {
    if (!name.trim() || !activeWorkspaceId) return;
    
    setIsCreating(true);
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, workspaceId: activeWorkspaceId })
      });
      if (res.ok) {
        const newKb = await res.json();
        setKbs([newKb, ...kbs]);
        setIsOpen(false);
        setName("");
        setDescription("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Knowledge Bases</h1>
          <p className="text-muted-foreground mt-1">Organize your documents into focused collections for AI retrieval.</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Plus size={16} /> Create Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] glass">
            <DialogHeader>
              <DialogTitle>New Knowledge Base</DialogTitle>
              <DialogDescription>
                Group related documents together. You can chat with specific knowledge bases later.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">Name</label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q3 Financial Reports"
                  className="bg-background/50"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="description" className="text-sm font-medium">Description (Optional)</label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Earnings calls, balance sheets, and projections"
                  className="bg-background/50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Loading your collections...</p>
        </div>
      ) : kbs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-3xl border border-border/50 bg-background/30">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
            <Database size={32} />
          </div>
          <h2 className="text-2xl font-heading font-semibold">No Knowledge Bases Found</h2>
          <p className="text-muted-foreground mt-2 max-w-sm mb-6">
            Create your first knowledge base to start organizing your documents for the AI.
          </p>
          <Button onClick={() => setIsOpen(true)} className="gap-2">
            <Plus size={16} /> Create Now
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kbs.map((kb) => (
            <Link href={`/knowledge-bases/${kb.id}`} key={kb.id} className="group flex flex-col p-6 rounded-3xl glass border border-border/50 hover:border-primary/30 transition-all shadow-sm hover:shadow-md hover:shadow-primary/5 cursor-pointer block">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <FolderOpen size={20} />
                </div>
              </div>
              <h3 className="font-semibold text-lg font-heading mb-1 truncate group-hover:text-primary transition-colors">{kb.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] mb-4">
                {kb.description || "No description provided."}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <span>{kb._count?.documents || 0} Documents</span>
                <span>{formatDistanceToNow(new Date(kb.createdAt), { addSuffix: true })}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
