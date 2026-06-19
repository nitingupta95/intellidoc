"use client";

import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddExistingDialogProps {
  isAddExistingOpen: boolean;
  setIsAddExistingOpen: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspaceDocuments: any[];
  selectedDocumentIds: string[];
  toggleDocumentSelection: (id: string) => void;
  handleLinkDocuments: () => Promise<void>;
  isLinking: boolean;
}

export function AddExistingDialog({
  isAddExistingOpen,
  setIsAddExistingOpen,
  workspaceDocuments,
  selectedDocumentIds,
  toggleDocumentSelection,
  handleLinkDocuments,
  isLinking,
}: AddExistingDialogProps) {
  return (
    <Dialog open={isAddExistingOpen} onOpenChange={setIsAddExistingOpen}>
      <DialogContent className="sm:max-w-[500px] glass max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Existing Document</DialogTitle>
          <DialogDescription>
            Select documents from your workspace to add to this knowledge base.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4 min-h-[200px]">
          {workspaceDocuments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No available documents found in the workspace.
            </div>
          ) : (
            <div className="space-y-2">
              {workspaceDocuments.map((doc) => (
                <label 
                  key={doc.id} 
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-background/40 cursor-pointer transition-colors"
                >
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    checked={selectedDocumentIds.includes(doc.id)}
                    onChange={() => toggleDocumentSelection(doc.id)}
                  />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText size={16} className="text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{doc.title}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="mt-4 pt-4 border-t border-border/50">
          <Button variant="outline" onClick={() => setIsAddExistingOpen(false)}>Cancel</Button>
          <Button onClick={handleLinkDocuments} disabled={selectedDocumentIds.length === 0 || isLinking}>
            {isLinking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isLinking ? "Adding..." : `Add ${selectedDocumentIds.length} Document(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
