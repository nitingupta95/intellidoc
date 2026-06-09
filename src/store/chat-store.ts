import { create } from 'zustand';

export interface Citation {
  score: number;
  text_snippet: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
}

interface ChatState {
  messages: Message[];
  isGenerating: boolean;
  addMessage: (msg: Message) => void;
  appendStreamToLastMessage: (chunk: string) => void;
  setCitationsToLastMessage: (citations: Citation[]) => void;
  setGenerating: (status: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isGenerating: false,
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  appendStreamToLastMessage: (chunk) => set((state) => {
    const newMessages = [...state.messages];
    const lastMsg = newMessages[newMessages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      lastMsg.content += chunk;
    }
    return { messages: newMessages };
  }),
  setCitationsToLastMessage: (citations) => set((state) => {
    const newMessages = [...state.messages];
    const lastMsg = newMessages[newMessages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      lastMsg.citations = citations;
    }
    return { messages: newMessages };
  }),
  setGenerating: (status) => set({ isGenerating: status }),
  clearMessages: () => set({ messages: [] }),
}));
