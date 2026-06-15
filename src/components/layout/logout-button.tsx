"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function LogoutButton({ iconOnly }: { iconOnly?: boolean }) {
  const [showModal, setShowModal] = useState(false);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className={`w-full flex items-center ${iconOnly ? "justify-center px-0" : "gap-3 px-3"} py-2 text-sm font-medium text-muted-foreground rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-left mt-2`}
        title={iconOnly ? "Sign Out" : undefined}
      >
        <LogOut size={20} />
        {!iconOnly && "Sign Out"}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
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
