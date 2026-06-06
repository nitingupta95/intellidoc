"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import {
  LayoutDashboard,
  Files,
  MessageSquare,
  Database,
  Network,
  Settings,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function MainSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside className={`glass border-r border-border flex flex-col justify-between hidden md:flex shrink-0 transition-all duration-300 ${isOpen ? "w-64" : "w-20"}`}>
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
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} className="mb-8">
            <PanelLeftOpen size={18} className="text-muted-foreground" />
          </Button>
        )}
        
        <nav className="space-y-2 flex-1">
          <NavItem href="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" active={pathname === "/dashboard"} isOpen={isOpen} />
          <NavItem href="/documents" icon={<Files size={20} />} label="Documents" active={pathname === "/documents"} isOpen={isOpen} />
          <NavItem href="/chat" icon={<MessageSquare size={20} />} label="AI Chat" active={pathname.startsWith("/chat")} isOpen={isOpen} />
          <NavItem href="/knowledge-bases" icon={<Database size={20} />} label="Knowledge Bases" active={pathname.startsWith("/knowledge-bases")} isOpen={isOpen} />
          <NavItem href="/knowledge-graph" icon={<Network size={20} />} label="Knowledge Graph" active={pathname === "/knowledge-graph"} isOpen={isOpen} />
        </nav>

        <div className="space-y-2 border-t border-border/50 pt-4 mt-auto">
          <NavItem href="/billing" icon={<CreditCard size={20} />} label="Billing" active={pathname === "/billing"} isOpen={isOpen} />
          <NavItem href="/settings" icon={<Settings size={20} />} label="Settings" active={pathname === "/settings"} isOpen={isOpen} />
          {isOpen ? (
            <LogoutButton />
          ) : (
            <div className="flex justify-center w-full">
              <LogoutButton iconOnly />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, active, isOpen }: { href: string; icon: React.ReactNode; label: string; active?: boolean; isOpen: boolean }) {
  return (
    <Link
      href={href}
      title={!isOpen ? label : undefined}
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
