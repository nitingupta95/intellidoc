"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";

interface WorkspaceDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  workspaceName: string;
  setWorkspaceName: (name: string) => void;
  workspaceDesc: string;
  setWorkspaceDesc: (desc: string) => void;
  onCreate: () => Promise<void>;
  isCreating: boolean;
}

export function WorkspaceDialog({
  isOpen,
  setIsOpen,
  workspaceName,
  setWorkspaceName,
  workspaceDesc,
  setWorkspaceDesc,
  onCreate,
  isCreating,
}: WorkspaceDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={16} />
          Create Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-border/50">
        <DialogHeader>
          <DialogTitle>Create a new workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace Name</label>
            <Input 
              placeholder="e.g., Engineering Team" 
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <Input 
              placeholder="What is this workspace for?" 
              value={workspaceDesc}
              onChange={(e) => setWorkspaceDesc(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <Button onClick={onCreate} className="w-full" disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : "Create Workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
