"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Shield, User } from "lucide-react";

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
  return (
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
                      onClick={() => onRemoveMember(member.userId)}
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
  );
}
