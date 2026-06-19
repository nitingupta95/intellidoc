"use client";

import { Button } from "@/components/ui/button";

interface SecuritySettingsProps {
  currentPassword: string;
  setCurrentPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  isPasswordSaving: boolean;
  is2FAEnabled: boolean;
  onUpdatePassword: () => Promise<void>;
  onToggle2FA: () => void;
}

export function SecuritySettings({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  isPasswordSaving,
  is2FAEnabled,
  onUpdatePassword,
  onToggle2FA,
}: SecuritySettingsProps) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 border border-border/50">
        <h2 className="text-xl font-heading font-semibold mb-6">Security & Access</h2>
        
        <div className="space-y-6">
          <div className="space-y-4 pb-6 border-b border-border/50">
            <h3 className="font-medium">Change Password</h3>
            <div className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" 
                />
              </div>
              <Button size="sm" onClick={onUpdatePassword} disabled={isPasswordSaving}>
                {isPasswordSaving ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pb-6 border-b border-border/50">
            <div className="max-w-md">
              <h3 className="font-medium">Two-Factor Authentication (2FA)</h3>
              <p className="text-sm text-muted-foreground mt-1">Add an extra layer of security to your account by requiring a verification code upon login.</p>
            </div>
            <Button 
              variant={is2FAEnabled ? "default" : "outline"} 
              className={is2FAEnabled ? "" : "glass"}
              onClick={onToggle2FA}
            >
              {is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
