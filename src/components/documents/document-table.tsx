"use client";

import Link from "next/link";
import { 
  Folder as FolderIcon, 
  FileText, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  MoreVertical, 
  Trash2 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  displayedFolders: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  displayedDocuments: any[];
  setCurrentFolderId: (id: string | null) => void;
  setDocumentToDelete: (id: string | null) => void;
  formatMimeType: (mime: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any;
}

export function DocumentTable({
  displayedFolders,
  displayedDocuments,
  setCurrentFolderId,
  setDocumentToDelete,
  formatMimeType,
  router,
}: DocumentTableProps) {
  return (
    <div className="hidden md:block glass-panel overflow-x-auto border border-border/50">
      <table className="w-full text-left text-sm table-fixed min-w-[1000px]">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[15%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead className="bg-background/40 border-b border-border/50">
          <tr>
            <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Size</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Uploaded By</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Uploaded</th>
            <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {displayedFolders.map((folder) => (
            <tr 
              key={`folder-${folder.id}`} 
              className="hover:bg-background/30 transition-colors group cursor-pointer" 
              onClick={() => setCurrentFolderId(folder.id)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                    <FolderIcon size={16} />
                  </div>
                  <span className="font-medium group-hover:text-primary transition-colors truncate">{folder.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">Folder</td>
              <td className="px-4 py-3 text-muted-foreground">-</td>
              <td className="px-4 py-3 text-muted-foreground">-</td>
              <td className="px-4 py-3">-</td>
              <td className="px-4 py-3 text-muted-foreground">{new Date(folder.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right"></td>
            </tr>
          ))}
          {displayedDocuments.map((doc, i) => (
            <tr 
              key={doc.id || i} 
              className="hover:bg-background/50 hover:text-foreground transition-colors group cursor-pointer"
              onClick={() => router.push(`/documents/${doc.id}`)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <FileText size={16} />
                  </div>
                  <Link 
                    href={`/documents/${doc.id}`} 
                    className="font-medium group-hover:text-foreground transition-colors hover:underline truncate" 
                    title={doc.title || doc.filename}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {doc.title || doc.filename}
                  </Link>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground group-hover:text-foreground transition-colors truncate">{formatMimeType(doc.mimeType)}</td>
              <td className="px-4 py-3 text-muted-foreground group-hover:text-foreground transition-colors truncate">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</td>
              <td className="px-4 py-3 text-muted-foreground group-hover:text-foreground transition-colors truncate">{doc.user?.name || "Unknown"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 group-hover:opacity-90">
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
              <td className="px-4 py-3 text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">{new Date(doc.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2 transition-opacity">
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/chat?documentId=${doc.id}&documentTitle=${encodeURIComponent(doc.title || doc.filename || 'Document')}`);
                    }}
                    variant="secondary" 
                    size="sm" 
                    className="h-8 gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    <span>Chat</span>
                  </Button>
                  <div className="flex items-center transition-opacity text-muted-foreground/50 hover:text-muted-foreground">
                    <Button 
                      onClick={() => setDocumentToDelete(doc.id)}
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title="Delete Document"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
