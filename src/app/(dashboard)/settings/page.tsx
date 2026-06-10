"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { User, Bell, Shield, Key, Moon, Monitor, Upload, Laptop, Smartphone, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  
  const user = session?.user;
  const nameParts = user?.name ? user.name.split(" ") : [];
  const firstName = nameParts[0] || "Alex";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Developer";
  const email = user?.email || "alex@intellidoc.ai";
  const image = user?.image || null;

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
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary border-2 border-primary/30 relative group cursor-pointer overflow-hidden">
                    {image ? (
                      <img src={image} alt="Profile" className="w-full h-full object-cover" />
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
                      <Button size="sm" variant="outline" className="glass h-8">Upload</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">Remove</Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <input type="text" defaultValue={firstName} className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input type="text" defaultValue={lastName} className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Email Address</label>
                    <input type="email" defaultValue={email} disabled className="w-full px-3 py-2 bg-background/30 border border-border/30 rounded-md text-sm text-muted-foreground cursor-not-allowed" />
                    <p className="text-xs text-muted-foreground mt-1">To change your email address, contact support.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="ghost">Cancel</Button>
                <Button>Save Changes</Button>
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
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Document Processing</h3>
                      <p className="text-sm text-muted-foreground">Get notified when a large document finishes indexing.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Security Alerts</h3>
                      <p className="text-sm text-muted-foreground">Critical notifications about your account security.</p>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">New Features</h3>
                      <p className="text-sm text-muted-foreground">Updates about new platform features and improvements.</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="ghost">Cancel</Button>
                <Button>Save Preferences</Button>
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
                        <input type="password" placeholder="••••••••" className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">New Password</label>
                        <input type="password" placeholder="••••••••" className="w-full px-3 py-2 glass bg-background/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
                      </div>
                      <Button size="sm">Update Password</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-6 border-b border-border/50">
                    <div className="max-w-md">
                      <h3 className="font-medium">Two-Factor Authentication (2FA)</h3>
                      <p className="text-sm text-muted-foreground mt-1">Add an extra layer of security to your account by requiring a verification code upon login.</p>
                    </div>
                    <Button variant="outline" className="glass">Enable 2FA</Button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-medium">Active Sessions</h3>
                    <div className="space-y-3">
                      <div className="p-4 rounded-lg bg-background/30 border border-border/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Laptop className="text-muted-foreground" size={20} />
                          <div>
                            <p className="font-medium text-sm">Mac OS • Chrome</p>
                            <p className="text-xs text-green-500 mt-0.5">Active now</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">San Francisco, CA</span>
                      </div>
                      <div className="p-4 rounded-lg bg-background/30 border border-border/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Smartphone className="text-muted-foreground" size={20} />
                          <div>
                            <p className="font-medium text-sm">iOS • Safari</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Last active: 2 days ago</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive h-8 text-xs">Revoke</Button>
                      </div>
                    </div>
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
                  <Button size="sm">Generate New Key</Button>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-background/30 border border-border/50 flex justify-between items-center group">
                    <div>
                      <h4 className="font-medium text-sm">Production Key</h4>
                      <p className="text-xs text-muted-foreground font-mono mt-1">sk_live_••••••••••••••••••••••••</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground self-center mr-2">Created Oct 2, 2025</span>
                      <Button variant="outline" size="sm" className="glass h-8">Revoke</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
