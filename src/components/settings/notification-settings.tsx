"use client";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface NotificationPreferences {
  emailDigest: boolean;
  documentProcessing: boolean;
  securityAlerts: boolean;
  newFeatures: boolean;
}

interface NotificationSettingsProps {
  notifications: NotificationPreferences;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationPreferences>>;
  isNotificationsSaving: boolean;
  onSaveNotifications: () => Promise<void>;
  onResetDefaults: () => void;
}

export function NotificationSettings({
  notifications,
  setNotifications,
  isNotificationsSaving,
  onSaveNotifications,
  onResetDefaults,
}: NotificationSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 border border-border/50">
        <h2 className="text-xl font-heading font-semibold mb-6">Notification Preferences</h2>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Email Digest</h3>
              <p className="text-sm text-muted-foreground">Receive a weekly summary of workspace activity.</p>
            </div>
            <Switch 
              checked={notifications.emailDigest} 
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, emailDigest: checked }))} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Document Processing</h3>
              <p className="text-sm text-muted-foreground">Get notified when a large document finishes indexing.</p>
            </div>
            <Switch 
              checked={notifications.documentProcessing} 
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, documentProcessing: checked }))} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Security Alerts</h3>
              <p className="text-sm text-muted-foreground">Critical notifications about your account security.</p>
            </div>
            <Switch 
              checked={notifications.securityAlerts} 
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, securityAlerts: checked }))} 
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">New Features</h3>
              <p className="text-sm text-muted-foreground">Updates about new platform features and improvements.</p>
            </div>
            <Switch 
              checked={notifications.newFeatures} 
              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, newFeatures: checked }))} 
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onResetDefaults}>Reset defaults</Button>
        <Button onClick={onSaveNotifications} disabled={isNotificationsSaving}>
          {isNotificationsSaving ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
