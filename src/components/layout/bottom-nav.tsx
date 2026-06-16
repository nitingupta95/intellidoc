"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Files, MessageSquare, Settings, Database, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function BottomNav() {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const navItems = [
    { href: "/dashboard", icon: <LayoutDashboard size={24} />, label: "Home" },
    { href: "/documents", icon: <Files size={24} />, label: "Files" },
    { href: "/knowledge-bases", icon: <Database size={24} />, label: "KBs" },
    { href: "/chat", icon: <MessageSquare size={24} />, label: "Chat" },
    { href: "/settings", icon: <Settings size={24} />, label: "Settings" },
  ];

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px] transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.icon}
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setShowModal(true)}
            className="flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px] transition-colors text-muted-foreground hover:text-foreground"
          >
            <LogOut size={24} />
            <span className="text-[10px] mt-1 font-medium">Logout</span>
          </button>
        </div>
      </nav>

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-border shadow-lg rounded-xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold tracking-tight mb-2 text-foreground">Sign Out</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to sign out of IntelliDoc?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
