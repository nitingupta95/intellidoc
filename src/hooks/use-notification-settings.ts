"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface NotificationPreferences {
  emailDigest: boolean;
  documentProcessing: boolean;
  securityAlerts: boolean;
  newFeatures: boolean;
}

export function useNotificationSettings() {
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    emailDigest: true,
    documentProcessing: true,
    securityAlerts: true,
    newFeatures: false
  });
  const [isNotificationsSaving, setIsNotificationsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/user/notifications")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.preferences) {
          setNotifications(data.preferences);
        }
      })
      .catch(err => console.error("Failed to fetch notification preferences", err));
  }, []);

  const handleSaveNotifications = async () => {
    setIsNotificationsSaving(true);
    try {
      const res = await fetch("/api/user/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: notifications })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Notification preferences saved");
      } else {
        toast.error(data.error || "Failed to save preferences");
      }
    } catch (error: any) {
      toast.error("Failed to save preferences: " + (error.message || "Unknown error"));
    } finally {
      setIsNotificationsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setNotifications({
      emailDigest: true,
      documentProcessing: true,
      securityAlerts: true,
      newFeatures: false
    });
  };

  return {
    notifications,
    setNotifications,
    isNotificationsSaving,
    handleSaveNotifications,
    handleResetDefaults,
  };
}
