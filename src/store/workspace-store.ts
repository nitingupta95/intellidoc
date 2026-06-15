import { create } from 'zustand';

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  role?: string;
  createdAt: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  
  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  isLoading: false,

  loadWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/workspaces');
      if (!res.ok) throw new Error('Failed to fetch workspaces');
      const data = await res.json();
      
      const workspaces = data.workspaces || [];
      set({ workspaces });
      
      // If no active workspace is selected and we have workspaces, select the first one
      const { activeWorkspaceId } = get();
      if (!activeWorkspaceId && workspaces.length > 0) {
        set({ activeWorkspaceId: workspaces[0].id });
      }
    } catch (e) {
      console.error('Failed to load workspaces', e);
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id });
  },
}));
