"use client";

import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export interface UploadQueueItem {
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

interface UploadSectionProps {
  isUploading: boolean;
  isDragOver: boolean;
  activeWorkspaceId: string | null;
  uploadQueue: UploadQueueItem[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadSection({
  isUploading,
  isDragOver,
  activeWorkspaceId,
  uploadQueue,
  fileInputRef,
  handleDrop,
  handleDragOver,
  handleDragLeave,
  handleFileChange,
}: UploadSectionProps) {
  const handleZoneClick = () => {
    if (!activeWorkspaceId) {
      toast.error("Please select a workspace first");
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6 shrink-0">
      {/* Upload Zone */}
      <div 
        onClick={handleZoneClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`glass border-dashed border-2 rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all group ${
          isDragOver 
            ? 'border-primary bg-primary/5 scale-[1.01]' 
            : 'border-border/50'
        } ${activeWorkspaceId ? 'hover:bg-background/40 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
        data-tour="upload-zone"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange} 
          accept=".pdf,.docx,.txt,.md,.csv" 
          disabled={!activeWorkspaceId}
          multiple
        />
        <div className={`w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 transition-transform ${isDragOver ? 'scale-125' : 'group-hover:scale-110'}`}>
          {isUploading ? <Loader2 size={28} className="animate-spin" /> : <Upload size={28} />}
        </div>
        <h3 className="text-lg font-heading font-semibold">
          {isUploading ? "Uploading..." : isDragOver ? "Drop files here" : "Click or drag files to upload"}
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Support for PDF, DOCX, PPTX, TXT, MD, CSV, JSON. Maximum file size 50MB. Multiple files supported.
        </p>
      </div>

      {/* Upload Queue Progress */}
      {uploadQueue.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {uploadQueue.map((item, i) => (
            <div key={i} className="glass-panel p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                item.status === 'done' ? 'bg-green-500/20 text-green-500' :
                item.status === 'error' ? 'bg-destructive/20 text-destructive' :
                'bg-primary/20 text-primary'
              }`}>
                {item.status === 'done' ? <CheckCircle2 size={16} /> :
                 item.status === 'error' ? '✗' :
                 <Loader2 size={16} className="animate-spin" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.status === 'done' ? 'bg-green-500' :
                      item.status === 'error' ? 'bg-destructive' :
                      'bg-primary'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
