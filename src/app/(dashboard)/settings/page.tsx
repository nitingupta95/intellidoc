"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { User, Bell, Shield, Key, Moon, Monitor, Upload, Sun, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const { theme, setTheme } = useTheme();
  const { data: session, update } = useSession();
  
  const user = session?.user;
  const nameParts = user?.name ? user.name.split(" ") : [];
  const initialFirstName = nameParts[0] || "Alex";
  const initialLastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Developer";
  const email = user?.email || "alex@intellidoc.ai";
  const image = user?.image || null;

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openApiKey, setOpenApiKey] = useState("");
  const [maskedOpenApiKey, setMaskedOpenApiKey] = useState<string | null>(null);
  
  const [geminiKey, setGeminiKey] = useState("");
  const [maskedGeminiKey, setMaskedGeminiKey] = useState<string | null>(null);
  const [isSystemGeminiKey, setIsSystemGeminiKey] = useState(false);
  
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [isOpenAiKeySaving, setIsOpenAiKeySaving] = useState(false);
  const [isGeminiKeySaving, setIsGeminiKeySaving] = useState(false);

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState({
    emailDigest: true,
    documentProcessing: true,
    securityAlerts: true,
    newFeatures: false
  });
  const [isNotificationsSaving, setIsNotificationsSaving] = useState(false);

  useEffect(() => {
    // Fetch API Keys
    fetch("/api/user/key")
      .then(res => res.json())
      .then(data => {
        if (data.hasOpenAIKey) setMaskedOpenApiKey(data.maskedOpenAIKey);
        if (data.hasGeminiKey) {
          setMaskedGeminiKey(data.maskedGeminiKey);
          setIsSystemGeminiKey(data.isSystemGeminiKey);
        }
        setIsKeyLoading(false);
      })
      .catch(() => setIsKeyLoading(false));

    // Fetch Notification Preferences
    fetch("/api/user/notifications")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.preferences) {
          setNotifications(data.preferences);
        }
      })
      .catch(err => console.error("Failed to fetch notification preferences", err));
  }, []);

  // Update local state when session data loads
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
    } catch (error) {
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
    } catch (error) {
      toast.error("Failed to remove profile picture");
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleSaveOpenApiKey = async () => {
    if (!openApiKey) return;
    setIsOpenAiKeySaving(true);
    try {
      const res = await fetch("/api/user/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiKey: openApiKey })
      });
      const data = await res.json();
      if (data.success) {
        setMaskedOpenApiKey(openApiKey.length > 8 ? `sk-...${openApiKey.slice(-4)}` : "sk-...****");
        setOpenApiKey("");
        toast.success("OpenAI API Key saved successfully");
      } else {
        toast.error(data.error || "Failed to save OpenAI API Key");
      }
    } catch (error: any) {
      toast.error("Failed to save OpenAI API Key: " + (error.message || "Unknown error"));
    } finally {
      setIsOpenAiKeySaving(false);
    }
  };

  const handleRevokeOpenApiKey = async () => {
    setIsOpenAiKeySaving(true);
    try {
      const res = await fetch("/api/user/key", { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "openai" })
      });
      const data = await res.json();
      if (data.success) {
        setMaskedOpenApiKey(null);
        toast.success("OpenAI API Key revoked");
      } else {
        toast.error(data.error || "Failed to revoke OpenAI API Key");
      }
    } catch (error: any) {
      toast.error("Failed to revoke OpenAI API Key: " + (error.message || "Unknown error"));
    } finally {
      setIsOpenAiKeySaving(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!geminiKey) return;
    setIsGeminiKeySaving(true);
    try {
      const res = await fetch("/api/user/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiKey })
      });
      const data = await res.json();
      if (data.success) {
        setMaskedGeminiKey(geminiKey.length > 8 ? `...${geminiKey.slice(-4)}` : "...****");
        setIsSystemGeminiKey(false);
        setGeminiKey("");
        toast.success("Gemini API Key saved successfully");
      } else {
        toast.error(data.error || "Failed to save Gemini API Key");
      }
    } catch (error: any) {
      toast.error("Failed to save Gemini API Key: " + (error.message || "Unknown error"));
    } finally {
      setIsGeminiKeySaving(false);
    }
  };

  const handleRevokeGeminiKey = async () => {
    setIsGeminiKeySaving(true);
    try {
      const res = await fetch("/api/user/key", { 
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "gemini" })
      });
      const data = await res.json();
      if (data.success) {
        // We reload to get the system key if it exists
        const keyRes = await fetch("/api/user/key");
        const keyData = await keyRes.json();
        if (keyData.hasGeminiKey) {
          setMaskedGeminiKey(keyData.maskedGeminiKey);
          setIsSystemGeminiKey(keyData.isSystemGeminiKey);
        } else {
          setMaskedGeminiKey(null);
          setIsSystemGeminiKey(false);
        }
        toast.success("Gemini API Key revoked");
      } else {
        toast.error(data.error || "Failed to revoke Gemini API Key");
      }
    } catch (error: any) {
      toast.error("Failed to revoke Gemini API Key: " + (error.message || "Unknown error"));
    } finally {
      setIsGeminiKeySaving(false);
    }
  };

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
            { id: "appearance", label: "Appearance", icon: Moon },
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
                        onChange={handleImageUpload} 
                      />
                      <Button size="sm" variant="outline" className="glass h-8" onClick={() => fileInputRef.current?.click()} disabled={isImageUploading}>
                        Upload
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleImageRemove} disabled={isImageUploading || !profileImage}>
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
                <Button variant="ghost" onClick={() => { setFirstName(initialFirstName); setLastName(initialLastName); }}>Cancel</Button>
                <Button onClick={handleSaveProfile} disabled={isProfileSaving}>
                  {isProfileSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div className="glass-panel p-6 border border-border/50">
                <h2 className="text-xl font-heading font-semibold mb-4">Theme Preferences</h2>
                <p className="text-sm text-muted-foreground mb-6">Customize the appearance of your workspace.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { id: "light", name: "Light", icon: Sun },
                    { id: "dark", name: "Dark", icon: Moon },
                    { id: "system", name: "System", icon: Monitor },
                  ].map((t) => (
                    <div 
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                        theme === t.id 
                          ? "border-primary bg-primary/5 shadow-[0_0_20px_-10px_rgba(var(--primary),0.5)]" 
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center border border-border">
                        <t.icon size={20} className={theme === t.id ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <span className={`text-sm font-medium ${theme === t.id ? "text-foreground" : "text-muted-foreground"}`}>
                        {t.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
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
                <Button variant="ghost" onClick={() => setNotifications({ emailDigest: true, documentProcessing: true, securityAlerts: true, newFeatures: false })}>Reset defaults</Button>
                <Button onClick={handleSaveNotifications} disabled={isNotificationsSaving}>
                  {isNotificationsSaving ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
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
                      <Button size="sm" onClick={handleUpdatePassword} disabled={isPasswordSaving}>
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
                      onClick={() => {
                        setIs2FAEnabled(!is2FAEnabled);
                        toast.success(is2FAEnabled ? "2FA Disabled" : "2FA Enabled");
                      }}
                    >
                      {is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <div className="space-y-6">
              <div className="glass-panel p-6 border border-border/50">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-heading font-semibold">API Keys</h2>
                    <p className="text-sm text-muted-foreground">Manage your secret keys for programmatic access.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {isKeyLoading ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
                  ) : (
                    <div className="space-y-6">
                      {/* OpenAI Key Section */}
                      <div>
                        {maskedOpenApiKey ? (
                          <div className="p-4 rounded-lg bg-background/30 border border-border/50 flex justify-between items-center group">
                            <div>
                              <h4 className="font-medium text-sm">OpenAI API Key</h4>
                              <p className="text-xs text-muted-foreground font-mono mt-1">{maskedOpenApiKey}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="glass h-8" onClick={handleRevokeOpenApiKey} disabled={isOpenAiKeySaving}>
                                {isOpenAiKeySaving ? "Revoking..." : "Revoke"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">You have not set an OpenAI API Key. Provide one to enable OpenAI functionality.</p>
                            <div className="flex flex-col gap-2 max-w-md">
                              <label className="text-sm font-medium">OpenAI API Key</label>
                              <input 
                                type="password" 
                                placeholder="sk-..." 
                                value={openApiKey}
                                onChange={(e) => setOpenApiKey(e.target.value)}
                                className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" 
                              />
                              <Button size="sm" className="w-fit mt-2" onClick={handleSaveOpenApiKey} disabled={!openApiKey || isOpenAiKeySaving}>
                                {isOpenAiKeySaving ? "Saving..." : "Save OpenAI Key"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <hr className="border-border/50" />

                      {/* Gemini Key Section */}
                      <div>
                        {maskedGeminiKey && !isSystemGeminiKey ? (
                          <div className="p-4 rounded-lg bg-background/30 border border-border/50 flex justify-between items-center group">
                            <div>
                              <h4 className="font-medium text-sm">Gemini API Key</h4>
                              <p className="text-xs text-muted-foreground font-mono mt-1">{maskedGeminiKey}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="glass h-8" onClick={handleRevokeGeminiKey} disabled={isGeminiKeySaving}>
                                {isGeminiKeySaving ? "Revoking..." : "Revoke"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                            <div className="space-y-4">
                              {isSystemGeminiKey ? (
                                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-left mb-4">
                                  <h3 className="font-semibold text-primary text-sm mb-1">System Default Key Active</h3>
                                  <p className="text-xs text-muted-foreground">
                                    You are currently using the free default IntelliDoc key. You can provide your own personal API key below to override this.
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm text-muted-foreground">You have not set a Gemini API Key. Provide one to enable Gemini AI functionality.</p>
                                  
                                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-left max-w-md">
                                    <h3 className="font-semibold text-primary text-sm mb-1">Need a free API key?</h3>
                                    <p className="text-xs text-muted-foreground mb-3">
                                      You can get a free Gemini API key from Google AI Studio.
                                    </p>
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                                      <Button variant="outline" className="w-full text-xs h-8">Get Free Gemini Key</Button>
                                    </a>
                                  </div>
                                </>
                              )}
                            <div className="flex flex-col gap-2 max-w-md">
                              <label className="text-sm font-medium">Gemini API Key</label>
                              <input 
                                type="password" 
                                placeholder="AIza..." 
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" 
                              />
                              <Button size="sm" className="w-fit mt-2" onClick={handleSaveGeminiKey} disabled={!geminiKey || isGeminiKeySaving}>
                                {isGeminiKeySaving ? "Saving..." : "Save Gemini Key"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
