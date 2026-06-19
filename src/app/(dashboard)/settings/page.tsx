"use client";

import { useState } from "react";
import { User, Bell, Shield, Key } from "lucide-react";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { ApiSettings } from "@/components/settings/api-settings";
import { useProfileSettings } from "@/hooks/use-profile-settings";
import { useNotificationSettings } from "@/hooks/use-notification-settings";
import { useSecuritySettings } from "@/hooks/use-security-settings";
import { useApiKeys } from "@/hooks/use-api-keys";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  const profile = useProfileSettings();
  const notificationPrefs = useNotificationSettings();
  const security = useSecuritySettings();
  const apiKeys = useApiKeys();

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="shrink-0">
        <h1 className="text-3xl font-heading font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and configurations.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0 overflow-y-auto pb-6">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 space-y-1 shrink-0">
          {[
            { id: "profile", label: "Profile", icon: User },
            { id: "notifications", label: "Notifications", icon: Bell },
            { id: "security", label: "Security & Access", icon: Shield },
            { id: "api", label: "API Keys", icon: Key },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 max-w-3xl space-y-8">
          {activeTab === "profile" && (
            <ProfileSettings
              firstName={profile.firstName}
              setFirstName={profile.setFirstName}
              lastName={profile.lastName}
              setLastName={profile.setLastName}
              email={profile.email}
              profileImage={profile.profileImage}
              isImageUploading={profile.isImageUploading}
              fileInputRef={profile.fileInputRef}
              isProfileSaving={profile.isProfileSaving}
              onSaveProfile={profile.handleSaveProfile}
              onImageUpload={profile.handleImageUpload}
              onImageRemove={profile.handleImageRemove}
              onCancel={profile.handleCancel}
            />
          )}

          {activeTab === "notifications" && (
            <NotificationSettings
              notifications={notificationPrefs.notifications}
              setNotifications={notificationPrefs.setNotifications}
              isNotificationsSaving={notificationPrefs.isNotificationsSaving}
              onSaveNotifications={notificationPrefs.handleSaveNotifications}
              onResetDefaults={notificationPrefs.handleResetDefaults}
            />
          )}

          {activeTab === "security" && (
            <SecuritySettings
              currentPassword={security.currentPassword}
              setCurrentPassword={security.setCurrentPassword}
              newPassword={security.newPassword}
              setNewPassword={security.setNewPassword}
              isPasswordSaving={security.isPasswordSaving}
              is2FAEnabled={security.is2FAEnabled}
              onUpdatePassword={security.handleUpdatePassword}
              onToggle2FA={security.handleToggle2FA}
            />
          )}

          {activeTab === "api" && (
            <ApiSettings
              openApiKey={apiKeys.openApiKey}
              setOpenApiKey={apiKeys.setOpenApiKey}
              maskedOpenApiKey={apiKeys.maskedOpenApiKey}
              isOpenAiKeySaving={apiKeys.isOpenAiKeySaving}
              onSaveOpenApiKey={apiKeys.handleSaveOpenApiKey}
              onRevokeOpenApiKey={apiKeys.handleRevokeOpenApiKey}
              geminiKey={apiKeys.geminiKey}
              setGeminiKey={apiKeys.setGeminiKey}
              maskedGeminiKey={apiKeys.maskedGeminiKey}
              isSystemGeminiKey={apiKeys.isSystemGeminiKey}
              isGeminiKeySaving={apiKeys.isGeminiKeySaving}
              onSaveGeminiKey={apiKeys.handleSaveGeminiKey}
              onRevokeGeminiKey={apiKeys.handleRevokeGeminiKey}
              isKeyLoading={apiKeys.isKeyLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
