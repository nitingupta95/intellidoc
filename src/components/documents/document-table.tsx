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
    <div className="hidden md:block glass-panel overflow-hidden border border-border/50">
      <table className="w-full text-left text-sm table-fixed">
        <colgroup>
          <col className="w-[32%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="bg-background/40 border-b border-border/50">
          <tr>
            <th className="px-6 py-4 font-medium text-muted-foreground">Name</th>
            <th className="px-6 py-4 font-medium text-muted-foreground">Type</th>
            <th className="px-6 py-4 font-medium text-muted-foreground">Size</th>
            <th className="px-6 py-4 font-medium text-muted-foreground">Uploaded By</th>
            <th className="px-6 py-4 font-medium text-muted-foreground">Status</th>
            <th className="px-6 py-4 font-medium text-muted-foreground">Uploaded</th>
            <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {displayedFolders.map((folder) => (
            <tr 
              key={`folder-${folder.id}`} 
              className="hover:bg-background/30 transition-colors group cursor-pointer" 
              onClick={() => setCurrentFolderId(folder.id)}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                    <FolderIcon size={16} />
                  </div>
                  <span className="font-medium group-hover:text-primary transition-colors truncate">{folder.name}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-muted-foreground">Folder</td>
              <td className="px-6 py-4 text-muted-foreground">-</td>
              <td className="px-6 py-4 text-muted-foreground">-</td>
              <td className="px-6 py-4">-</td>
              <td className="px-6 py-4 text-muted-foreground">{new Date(folder.createdAt).toLocaleDateString()}</td>
              <td className="px-6 py-4 text-right"></td>
            </tr>
          ))}
          {displayedDocuments.map((doc, i) => (
            <tr key={doc.id || i} className="hover:bg-background/30 transition-colors group">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <FileText size={16} />
                  </div>
                  <Link 
                    href={`/documents/${doc.id}`} 
                    className="font-medium group-hover:text-primary transition-colors hover:underline truncate" 
                    title={doc.title || doc.filename}
                  >
                    {doc.title || doc.filename}
                  </Link>
                </div>
              </td>
              <td className="px-6 py-4 text-muted-foreground truncate">{formatMimeType(doc.mimeType)}</td>
              <td className="px-6 py-4 text-muted-foreground truncate">{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</td>
              <td className="px-6 py-4 text-muted-foreground truncate">{doc.user?.name || "Unknown"}</td>
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
              <td className="px-6 py-4 text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</td>
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <MoreVertical size={16} />
                  </Button>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
