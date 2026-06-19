"use client";

import { useState } from "react";
import { toast } from "sonner";

export function useSecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Please enter both current and new passwords");
      return;
    }
    setIsPasswordSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        toast.error(data.error || "Failed to update password");
      }
    } catch (error: any) {
      toast.error("Failed to update password: " + (error.message || "Unknown error"));
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleToggle2FA = () => {
    const nextVal = !is2FAEnabled;
    setIs2FAEnabled(nextVal);
    toast.success(nextVal ? "2FA Enabled" : "2FA Disabled");
  };

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    isPasswordSaving,
    is2FAEnabled,
    handleUpdatePassword,
    handleToggle2FA,
  };
}
