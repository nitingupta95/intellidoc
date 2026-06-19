"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogoutButton } from "@/components/layout/logout-button";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import {
  LayoutDashboard,
  Files,
  MessageSquare,
  Database,
  Settings,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function MainSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const { data: session } = useSession();

  const user = session?.user;
  const nameParts = user?.name ? user.name.split(" ") : [];
  const initials = nameParts.length > 0 ? (nameParts[0][0] + (nameParts.length > 1 ? nameParts[1][0] : "")).toUpperCase() : "U";

  return (
    <aside className={`glass border-r border-border flex flex-col justify-between hidden lg:flex shrink-0 transition-all duration-300 ${isOpen ? "w-64" : "w-20"}`}>
      <div className={`p-4 flex flex-col h-full ${!isOpen && "items-center"}`}>
        <div className={`flex items-center ${isOpen ? "justify-between" : "justify-center"} mb-8`}>
          {isOpen ? (
            <Link href="/dashboard" className="flex items-center gap-2 font-heading font-bold text-xl tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                ID
              </div>
              <span className="truncate">IntelliDoc</span>
            </Link>
          ) : (
            <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              ID
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className={isOpen ? "" : "hidden"}>
            <PanelLeftClose size={18} className="text-muted-foreground" />
          </Button>
        </div>

        {!isOpen && (
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="mb-4">
            <PanelLeftOpen size={18} className="text-muted-foreground" />
          </Button>
        )}
        
        <WorkspaceSwitcher isOpen={isOpen} />
        
        <nav className="space-y-2 flex-1">
          <NavItem href="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" active={pathname === "/dashboard"} isOpen={isOpen} />
          <NavItem href="/knowledge-bases" icon={<Database size={20} />} label="Knowledge Bases" active={pathname === "/knowledge-bases"} isOpen={isOpen} dataTour="nav-kb" />
          <NavItem href="/documents" icon={<Files size={20} />} label="Documents" active={pathname === "/documents"} isOpen={isOpen} dataTour="nav-docs" />
          <NavItem href="/chat" icon={<MessageSquare size={20} />} label="AI Chat" active={pathname.startsWith("/chat")} isOpen={isOpen} dataTour="nav-chat" />
        </nav>

        <div className="space-y-2 border-t border-border/50 pt-4 mt-auto">
          <NavItem href="/billing" icon={<CreditCard size={20} />} label="Billing" active={pathname === "/billing"} isOpen={isOpen} />
          <NavItem href="/settings" icon={<Settings size={20} />} label="Settings" active={pathname === "/settings"} isOpen={isOpen} />
          
          <div className="pt-4 mt-4 border-t border-border/50 space-y-4">
            <div className={`flex items-center ${isOpen ? "gap-3 px-2" : "justify-center"}`}>
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/30 overflow-hidden">
                {user?.image ? (
                  <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-medium">{initials}</span>
                )}
              </div>
              {isOpen && (
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">{user?.name || "User"}</span>
                  <span className="text-xs text-muted-foreground truncate">{user?.email || "user@example.com"}</span>
                </div>
              )}
            </div>

            {isOpen ? (
              <LogoutButton />
            ) : (
              <div className="flex justify-center w-full">
                <LogoutButton iconOnly />
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, active, isOpen, dataTour }: { href: string; icon: React.ReactNode; label: string; active?: boolean; isOpen: boolean; dataTour?: string }) {
  return (
    <Link
      href={href}
      title={!isOpen ? label : undefined}
      data-tour={dataTour}
      className={`flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"} py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <div className="shrink-0">{icon}</div>
      {isOpen && <span className="truncate">{label}</span>}
    </Link>
  );
}
