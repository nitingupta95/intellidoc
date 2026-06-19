"use client";

import Link from "next/link";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Trash2 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface KbDocumentsTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  documents: any[];
  deleteDocument: (docId: string) => Promise<void>;
  formatMimeType: (mime: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
}

export function KbDocumentsTable({
  documents,
  deleteDocument,
  formatMimeType,
  router,
}: KbDocumentsTableProps) {
  return (
    <div className="hidden md:block glass-panel overflow-x-auto border border-border/50 rounded-2xl">
      <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
        <thead className="bg-background/40 border-b border-border/50">
          <tr>
            <th className="px-6 py-4 font-medium text-muted-foreground">Name</th>
            <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
            <th className="px-6 py-4 font-medium text-muted-foreground">Size</th>
            <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
            <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {documents.map((doc, i) => (
            <tr key={doc.id || i} className="hover:bg-background/30 transition-colors group">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <FileText size={16} />
                  </div>
                  <Link 
                    href={`/documents/${doc.id}`} 
                    className="font-medium group-hover:text-primary transition-colors hover:underline"
                  >
                    {doc.title}
                  </Link>
                </div>
              </td>
              <td className="px-6 py-4 text-muted-foreground truncate max-w-[150px]">{formatMimeType(doc.mimeType)}</td>
              <td className="px-6 py-4 text-muted-foreground">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {doc.status === 'INDEXED' ? (
                    <>
                      <CheckCircle2 size={14} className="text-green-500" />
                      <span className="text-green-500 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded-full">Indexed</span>
                    </>
                  ) : doc.status === 'UPLOADED' || doc.status === 'PROCESSING' ? (
                    <>
                      <Clock size={14} className="text-amber-500 animate-pulse" />
                      <span className="text-amber-500 text-xs font-medium bg-amber-500/10 px-2 py-0.5 rounded-full">Processing</span>
                    </>
                  ) : (
                    <span className="text-destructive text-xs font-medium bg-destructive/10 px-2 py-0.5 rounded-full">Error</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    onClick={() => router.push(`/chat?documentId=${doc.id}&documentTitle=${encodeURIComponent(doc.title)}`)}
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    title="Chat with Document"
                  >
                    <MessageSquare size={16} />
                  </Button>
                  <Button 
                    onClick={() => deleteDocument(doc.id)}
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    title="Delete Document"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
