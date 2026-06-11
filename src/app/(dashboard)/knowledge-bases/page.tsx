"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FolderGit2, Plus, Database, Users, Calendar, ArrowRight, Loader2, Library, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getKnowledgeBases, createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase } from "@/actions/knowledge-bases";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function KnowledgeBasesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [kbs, setKbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [editingKbId, setEditingKbId] = useState<string | null>(null);
  const [newKbName, setNewKbName] = useState("");
  const [newKbDesc, setNewKbDesc] = useState("");
  const [kbToDelete, setKbToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchKbs();
  }, []);

  const fetchKbs = async () => {
    setLoading(true);
    const res = await getKnowledgeBases();
    if (res.success && res.data) {
      setKbs(res.data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKbName.trim() || !session?.user?.id) return;
    
    setIsCreating(true);
    
    if (editingKbId) {
      const res = await updateKnowledgeBase(editingKbId, { 
        name: newKbName, 
        description: newKbDesc 
      });
      if (res.success) {
        setEditingKbId(null);
        setNewKbName("");
        setNewKbDesc("");
        fetchKbs();
      } else {
        toast.error("Failed to update knowledge base");
      }
    } else {
      const dummyTeamId = "team_123"; 
      const res = await createKnowledgeBase({ 
        name: newKbName, 
        description: newKbDesc, 
        teamId: dummyTeamId 
      });

      if (res.success) {
        setNewKbName("");
        setNewKbDesc("");
        fetchKbs();
      } else {
        toast.error("Failed to create knowledge base");
      }
    }
    setIsCreating(false);
  };

  const handleEditClick = (kb: any) => {
    setEditingKbId(kb.id);
    setNewKbName(kb.name);
    setNewKbDesc(kb.description || "");
  };

  const handleCancelEdit = () => {
    setEditingKbId(null);
    setNewKbName("");
    setNewKbDesc("");
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setKbToDelete(id);
  };

  const confirmDelete = async () => {
    if (!kbToDelete) return;
    setIsDeleting(true);
    const res = await deleteKnowledgeBase(kbToDelete);
    if (res.success) {
      fetchKbs();
      toast.success("Knowledge base deleted successfully");
    } else {
      toast.error("Failed to delete knowledge base");
    }
    setIsDeleting(false);
    setKbToDelete(null);
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Knowledge Bases</h1>
          <p className="text-muted-foreground mt-1">Organize your documents into intelligent collections.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Creation / Edit Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 border border-border/50 sticky top-0">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Library size={24} />
            </div>
            <h2 className="text-xl font-heading font-semibold mb-2">
              {editingKbId ? "Edit Knowledge Base" : "Create New Base"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Group related documents together to restrict RAG contexts or manage team access.
            </p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input 
                  type="text" 
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  placeholder="e.g. HR Policies 2025" 
                  className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  value={newKbDesc}
                  onChange={(e) => setNewKbDesc(e.target.value)}
                  placeholder="Optional description..." 
                  className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm h-24 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isCreating || !newKbName.trim()} className="flex-1">
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingKbId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />)}
                  {editingKbId ? "Save Changes" : "Create Base"}
                </Button>
                {editingKbId && (
                  <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* KB Grid */}
        <div className="lg:col-span-2 overflow-y-auto pb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Loading knowledge bases...</p>
            </div>
          ) : kbs.length === 0 ? (
            <div className="glass border-dashed border-2 border-border/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                <FolderGit2 size={28} />
              </div>
              <h3 className="text-lg font-heading font-semibold">No Knowledge Bases Found</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Create your first knowledge base to start organizing your document intelligence.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {kbs.map((kb) => (
                <div 
                  key={kb.id} 
                  className="glass-panel p-6 border border-border/50 hover:border-primary/30 transition-all group relative overflow-hidden flex flex-col cursor-pointer"
                  onClick={() => router.push(`/knowledge-bases/${kb.id}`)}
                >
                  {/* Decorative glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] group-hover:bg-primary/10 transition-colors pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="p-2.5 rounded-lg bg-background/50 text-foreground border border-border/50 shadow-sm">
                      <Database size={20} className="text-primary" />
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(kb);
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteClick(kb.id, e)}
                        disabled={isDeleting && kbToDelete === kb.id}
                      >
                        {isDeleting && kbToDelete === kb.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </Button>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-heading font-semibold mb-1 group-hover:text-primary transition-colors">{kb.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[40px]">
                    {kb.description || "No description provided."}
                  </p>
                  
                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center">
                        <FolderGit2 size={14} className="mr-1.5" />
                        {kb._count?.documents || 0} Documents
                      </div>
                      <div className="flex items-center">
                        <Users size={14} className="mr-1.5" />
                        Team
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                      <span className="text-xs text-muted-foreground flex items-center">
                        <Calendar size={12} className="mr-1" />
                        {new Date(kb.createdAt).toLocaleDateString()}
                      </span>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Enter <ArrowRight size={14} className="ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!kbToDelete} onOpenChange={(open) => !open && !isDeleting && setKbToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this knowledge base and all its associations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); confirmDelete(); }} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
