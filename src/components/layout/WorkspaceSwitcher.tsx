"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import Link from "next/link";

interface WorkspaceSwitcherProps {
  isOpen?: boolean;
  isMobile?: boolean;
}

export function WorkspaceSwitcher({ isOpen = true, isMobile = false }: WorkspaceSwitcherProps) {
  const { workspaces, activeWorkspaceId, loadWorkspaces, setActiveWorkspace, isLoading } = useWorkspaceStore();

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  if (!isOpen && !isMobile) {
    return (
      <div className="w-full flex justify-center mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Building2 size={18} />
        </div>
      </div>
    );
  }

  const menuItems = (
    <>
      {workspaces.map((workspace) => (
        <DropdownMenuItem 
          key={workspace.id}
          onClick={() => setActiveWorkspace(workspace.id)}
          className="flex items-center justify-between cursor-pointer"
        >
          <span className="truncate mr-2">{workspace.name}</span>
          {activeWorkspaceId === workspace.id && (
            <Check size={14} className="text-primary shrink-0" />
          )}
        </DropdownMenuItem>
      ))}
      <div className="h-px bg-border/50 my-1 mx-2" />
      <DropdownMenuItem asChild className="cursor-pointer">
        <Link href="/settings/team" className="flex items-center gap-2 text-primary">
          <Plus size={14} />
          <span>Manage Workspaces</span>
        </Link>
      </DropdownMenuItem>
    </>
  );

  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 px-2 h-9 border border-border/50 bg-background/50 glass-panel" data-tour="workspace-selector">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Building2 size={14} />
            </div>
            <span className="truncate max-w-[120px] font-medium">
              {isLoading ? "Loading..." : activeWorkspace?.name || "Select Workspace"}
            </span>
            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-popover border-border/50" align="end">
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="mb-6 w-full" data-tour="workspace-selector">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between border-border/50 bg-background/50 glass-panel"
            disabled={isLoading}
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 size={16} className="text-primary shrink-0" />
              <span className="truncate">
                {isLoading ? "Loading..." : activeWorkspace?.name || "Select Workspace"}
              </span>
            </div>
            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-popover border-border/50" align="start">
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
