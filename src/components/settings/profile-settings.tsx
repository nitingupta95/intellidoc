"use client";

import { User, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileSettingsProps {
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  email: string;
  profileImage: string | null;
  isImageUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isProfileSaving: boolean;
  onSaveProfile: () => Promise<void>;
  onImageUpload: React.ChangeEventHandler<HTMLInputElement>;
  onImageRemove: () => Promise<void>;
  onCancel: () => void;
}

export function ProfileSettings({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  profileImage,
  isImageUploading,
  fileInputRef,
  isProfileSaving,
  onSaveProfile,
  onImageUpload,
  onImageRemove,
  onCancel,
}: ProfileSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 border border-border/50">
        <h2 className="text-xl font-heading font-semibold mb-4">Personal Information</h2>
        
        <div className="flex items-center gap-6 mb-8">
          <div 
            className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary border-2 border-primary/30 relative group cursor-pointer overflow-hidden"
            onClick={() => fileInputRef.current?.click()}
          >
            {isImageUploading ? (
              <Loader2 size={24} className="animate-spin text-primary" />
            ) : profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={32} />
            )}
            <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload size={20} />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Profile Picture</h3>
            <p className="text-sm text-muted-foreground">JPG, GIF or PNG. Max size of 800K.</p>
            <div className="flex gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/gif" 
                onChange={onImageUpload} 
              />
              <Button size="sm" variant="outline" className="glass h-8" onClick={() => fileInputRef.current?.click()} disabled={isImageUploading}>
                Upload
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onImageRemove} disabled={isImageUploading || !profileImage}>
                Remove
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">First Name</label>
            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Last Name</label>
            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Email Address</label>
            <input type="email" defaultValue={email} disabled className="w-full px-3 py-2 bg-background/30 border border-border/30 rounded-md text-sm text-muted-foreground cursor-not-allowed" />
            <p className="text-xs text-muted-foreground mt-1">To change your email address, contact support.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSaveProfile} disabled={isProfileSaving}>
          {isProfileSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
