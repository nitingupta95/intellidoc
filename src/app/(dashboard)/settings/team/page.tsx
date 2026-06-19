"use client";

import { useSession } from "next-auth/react";
import { useTeamSettings } from "@/hooks/use-team-settings";
import { WorkspaceDialog } from "@/components/team/workspace-dialog";
import { InviteDialog } from "@/components/team/invite-dialog";
import { MembersTable } from "@/components/team/members-table";

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const {
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
  } = useTeamSettings();

  const workspaceDialogElement = (
    <WorkspaceDialog
      isOpen={isCreateOpen}
      setIsOpen={setIsCreateOpen}
      workspaceName={newWorkspaceName}
      setWorkspaceName={setNewWorkspaceName}
      workspaceDesc={newWorkspaceDesc}
      setWorkspaceDesc={setNewWorkspaceDesc}
      onCreate={handleCreateWorkspace}
      isCreating={isCreating}
    />
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
          {workspaceDialogElement}
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
        {workspaceDialogElement}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Members</h2>
        {isOwnerOrAdmin && (
          <InviteDialog
            isOpen={isInviteOpen}
            setIsOpen={setIsInviteOpen}
            inviteEmail={inviteEmail}
            setInviteEmail={setInviteEmail}
            inviteRole={inviteRole}
            setInviteRole={setInviteRole}
            onInvite={handleInvite}
            isInviting={isInviting}
          />
        )}
      </div>

      <MembersTable
        isLoading={isLoading}
        members={members}
        isOwnerOrAdmin={isOwnerOrAdmin}
        currentUserId={session?.user?.id}
        onRemoveMember={handleRemoveMember}
      />
    </div>
  );
}
