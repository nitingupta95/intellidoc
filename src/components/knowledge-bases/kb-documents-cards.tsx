"use client";

import Link from "next/link";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Trash2, 
  MoreVertical 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileDrawer } from "@/components/layout/mobile-drawer";

interface KbDocumentsCardsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documents: any[];
  deleteDocument: (docId: string) => Promise<void>;
  formatMimeType: (mime: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
}

export function KbDocumentsCards({
  documents,
  deleteDocument,
  formatMimeType,
  router,
}: KbDocumentsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:hidden">
      {documents.map((doc, i) => (
        <div 
          key={doc.id || i} 
          className="glass-panel p-4 flex flex-col gap-3 rounded-2xl border border-border/50"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText size={16} />
              </div>
              <div className="flex flex-col">
                <Link 
                  href={`/documents/${doc.id}`} 
                  className="font-medium text-sm line-clamp-1 hover:text-primary hover:underline transition-colors"
                >
                  {doc.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {(doc.fileSize / 1024 / 1024).toFixed(2)} MB • {formatMimeType(doc.mimeType)}
                </span>
              </div>
            </div>
            <MobileDrawer 
              title={doc.title} 
              description="Document Actions"
              trigger={
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                  <MoreVertical size={16} />
                </Button>
              }
            >
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => router.push(`/chat?documentId=${doc.id}&documentTitle=${encodeURIComponent(doc.title)}`)}
                  variant="outline" 
                  className="w-full justify-start h-12 rounded-xl"
                >
                  <MessageSquare className="mr-2 h-4 w-4" /> Chat
                </Button>
                <Button 
                  onClick={() => deleteDocument(doc.id)}
                  variant="outline" 
                  className="w-full justify-start h-12 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            </MobileDrawer>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {new Date(doc.createdAt).toLocaleDateString()}
            </span>
            <div className="flex items-center gap-1">
              {doc.status === 'INDEXED' ? (
                <span className="text-green-500 text-[10px] font-medium bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} /> Indexed
                </span>
              ) : doc.status === 'UPLOADED' || doc.status === 'PROCESSING' ? (
                <span className="text-amber-500 text-[10px] font-medium bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock size={12} className="animate-pulse" /> Processing
                </span>
              ) : (
                <span className="text-destructive text-[10px] font-medium bg-destructive/10 px-2 py-0.5 rounded-full">Error</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
