"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export function useProfileSettings() {
  const { data: session, update } = useSession();
  
  const user = session?.user;
  const nameParts = user?.name ? user.name.split(" ") : [];
  const initialFirstName = nameParts[0] || "Alex";
  const initialLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Developer";
  const email = user?.email || "alex@intellidoc.ai";

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user?.name) {
      const parts = session.user.name.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
    if (session?.user?.image !== undefined) {
      setProfileImage(session.user.image);
    }
  }, [session?.user?.name, session?.user?.image]);

  const handleSaveProfile = async () => {
    setIsProfileSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${firstName} ${lastName}`.trim() })
      });
      const data = await res.json();
      if (data.success) {
        await update({ name: `${firstName} ${lastName}`.trim() });
        toast.success("Profile updated successfully");
      } else {
        toast.error(data.error || "Failed to update profile");
      }
    } catch (error: any) {
      toast.error("Failed to update profile: " + (error.message || "Unknown error"));
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 800 * 1024) {
      toast.error("File size must be less than 800KB");
      return;
    }

    setIsImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const res = await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64String })
        });
        const data = await res.json();
        if (data.success) {
          setProfileImage(base64String);
          await update({ image: base64String });
          toast.success("Profile picture updated");
        } else {
          toast.error(data.error || "Failed to update profile picture");
        }
        setIsImageUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to process image");
      setIsImageUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImageRemove = async () => {
    setIsImageUploading(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: null })
      });
      const data = await res.json();
      if (data.success) {
        setProfileImage(null);
        await update({ image: null });
        toast.success("Profile picture removed");
      } else {
        toast.error(data.error || "Failed to remove profile picture");
      }
    } catch {
      toast.error("Failed to remove profile picture");
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleCancel = () => {
    setFirstName(initialFirstName);
    setLastName(initialLastName);
  };

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    profileImage,
    isImageUploading,
    fileInputRef,
    isProfileSaving,
    handleSaveProfile,
    handleImageUpload,
    handleImageRemove,
    handleCancel,
  };
}
