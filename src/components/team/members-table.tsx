"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Shield, User, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Member {
  id: string;
  userId: string;
  role: string;
  createdAt: string | Date;
  user: {
    name: string | null;
    email: string | null;
  };
}

interface MembersTableProps {
  isLoading: boolean;
  members: Member[];
  isOwnerOrAdmin: boolean;
  currentUserId?: string;
  onRemoveMember: (userId: string) => Promise<void>;
}

export function MembersTable({
  isLoading,
  members,
  isOwnerOrAdmin,
  currentUserId,
  onRemoveMember,
}: MembersTableProps) {
  // ── Remove confirmation dialog state ──────────────────────────────────────
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const pendingMember = members.find((m) => m.userId === pendingRemoveId);

  const handleConfirmRemove = async () => {
    if (!pendingRemoveId) return;
    setIsRemoving(true);
    try {
      await onRemoveMember(pendingRemoveId);
    } finally {
      setIsRemoving(false);
      setPendingRemoveId(null);
    }
  };

  return (
    <>
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
                    {isOwnerOrAdmin && member.userId !== currentUserId && member.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setPendingRemoveId(member.userId)}
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

      {/* ── Remove member confirmation AlertDialog ───────────────────────────── */}
      <AlertDialog
        open={!!pendingRemoveId}
        onOpenChange={(open) => { if (!open && !isRemoving) setPendingRemoveId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Remove Member
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold text-foreground">
                {pendingMember?.user.name || pendingMember?.user.email || "this member"}
              </span>{" "}
              from the workspace? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving} onClick={() => setPendingRemoveId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmRemove(); }}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing…
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
