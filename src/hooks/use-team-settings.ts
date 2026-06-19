"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { toast } from "sonner";

export function useTeamSettings() {
  const { activeWorkspaceId, workspaces, loadWorkspaces, setActiveWorkspace } = useWorkspaceStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const isOwnerOrAdmin = activeWorkspace?.role === "OWNER" || activeWorkspace?.role === "ADMIN";

  const fetchMembers = async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`);
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch {
      toast.error("Failed to fetch members");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchMembers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  const handleInvite = async () => {
    if (!inviteEmail || !activeWorkspaceId) return;
    setIsInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Invitation sent successfully");
        setIsInviteOpen(false);
        setInviteEmail("");
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch {
      toast.error("An error occurred while sending the invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members?userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Member removed");
        fetchMembers();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove member");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error("Workspace name is required");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName, description: newWorkspaceDesc }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Workspace created");
        setIsCreateOpen(false);
        setNewWorkspaceName("");
        setNewWorkspaceDesc("");
        await loadWorkspaces();
        setActiveWorkspace(data.workspace.id);
      } else {
        toast.error(data.error || "Failed to create workspace");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  return {
    activeWorkspaceId,
    activeWorkspace,
    isOwnerOrAdmin,
    members,
    isLoading,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    isInviteOpen,
    setIsInviteOpen,
    isInviting,
    isCreateOpen,
    setIsCreateOpen,
    newWorkspaceName,
    setNewWorkspaceName,
    newWorkspaceDesc,
    setNewWorkspaceDesc,
    isCreating,
    handleInvite,
    handleRemoveMember,
    handleCreateWorkspace,
  };
}
