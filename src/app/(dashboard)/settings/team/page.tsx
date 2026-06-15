"use client";

import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, UserPlus, Shield, User, Plus, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function TeamSettingsPage() {
  const { activeWorkspaceId, workspaces, loadWorkspaces, setActiveWorkspace } = useWorkspaceStore();
  const { data: session } = useSession();
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

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchMembers();
    }
  }, [activeWorkspaceId]);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/members`);
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch (error) {
      toast.error("Failed to fetch members");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
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
    } catch (error) {
      toast.error("An error occurred while sending the invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
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
    } catch (error) {
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
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const createWorkspaceDialog = (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus size={16} />
          Create Workspace
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border-border/50">
        <DialogHeader>
          <DialogTitle>Create a new workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace Name</label>
            <Input 
              placeholder="e.g., Engineering Team" 
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <Input 
              placeholder="What is this workspace for?" 
              value={newWorkspaceDesc}
              onChange={(e) => setNewWorkspaceDesc(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <Button onClick={handleCreateWorkspace} className="w-full" disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : "Create Workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!activeWorkspaceId) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-heading mb-2">Team Settings</h1>
            <p className="text-muted-foreground">Manage your team workspaces</p>
          </div>
        </div>
        <div className="glass-panel border-border/50 p-12 text-center rounded-xl space-y-4">
          <h2 className="text-xl font-semibold">No workspace selected</h2>
          <p className="text-muted-foreground mb-6">Create a workspace to start collaborating with your team.</p>
          {createWorkspaceDialog}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading mb-2">Team Settings</h1>
          <p className="text-muted-foreground">Manage members and roles for {activeWorkspace?.name}</p>
        </div>
        {createWorkspaceDialog}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Members</h2>
        {isOwnerOrAdmin && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus size={16} />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border/50">
              <DialogHeader>
                <DialogTitle>Invite a new member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email address</label>
                  <Input 
                    type="email" 
                    placeholder="colleague@example.com" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleInvite} className="w-full" disabled={isInviting}>
                  {isInviting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : "Send Invitation"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-background/50 overflow-hidden glass-panel">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                  Loading members...
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id} className="border-border/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="font-medium">{member.user.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      {member.role === "OWNER" || member.role === "ADMIN" ? (
                        <Shield size={14} className="text-primary" />
                      ) : (
                        <User size={14} className="text-muted-foreground" />
                      )}
                      <span className="capitalize">{member.role.toLowerCase()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {isOwnerOrAdmin && member.userId !== session?.user?.id && member.role !== "OWNER" && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveMember(member.userId)}
                        title="Remove Member"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
