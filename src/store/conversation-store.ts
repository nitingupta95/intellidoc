import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: any[];
  isStreaming?: boolean;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  isPinned: boolean;
  isArchived: boolean;
  knowledgeBaseId?: string;
  messages?: { content: string; createdAt: string }[];
  metadata?: Record<string, any>;
}

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isGenerating: boolean;
  isLoading: boolean;
  
  // Actions
  loadConversations: (workspaceId: string) => Promise<void>;
  createConversation: (title: string, workspaceId: string, knowledgeBaseId?: string, documentId?: string) => Promise<string>;
  setActiveConversation: (id: string | null) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (content: string, workspaceId: string, knowledgeBaseId?: string, documentId?: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  
  // Internals for streaming
  setGenerating: (generating: boolean) => void;
  addMessage: (message: Message) => void;
  appendStreamToLastMessage: (chunk: string) => void;
  setCitationsToLastMessage: (citations: any[]) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isGenerating: false,
  isLoading: false,

  loadConversations: async (workspaceId: string) => {
    try {
      const res = await fetch(`/api/conversations?workspaceId=${workspaceId}`);
      const data = await res.json();
      if (data.conversations) {
        set({ conversations: data.conversations });
      }
    } catch (e) {
      console.error('Failed to load conversations', e);
    }
  },

  createConversation: async (title = 'New Chat', workspaceId: string, knowledgeBaseId?: string, documentId?: string) => {
    const metadata: any = {};
    if (documentId) metadata.documentId = documentId;

    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title, 
        workspaceId,
        knowledgeBaseId,
        metadata 
      }),
    });
    const data = await res.json();
    if (data.conversation) {
      set((state) => ({
        conversations: [data.conversation, ...state.conversations],
        activeConversationId: data.conversation.id,
        messages: [],
      }));
      return data.conversation.id;
    }
    throw new Error('Failed to create conversation');
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().loadMessages(id);
    } else {
      set({ messages: [] });
    }
  },

  loadMessages: async (conversationId) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      const data = await res.json();
      if (data.messages) {
        // Parse citations JSON if it's a string
        const parsedMsgs = data.messages.map((m: any) => ({
          ...m,
          citations: typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations
        }));
        set({ messages: parsedMsgs });
      }
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteConversation: async (id) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        messages: state.activeConversationId === id ? [] : state.messages
      }));
    } catch (e) {
      console.error('Failed to delete conversation', e);
    }
  },

  renameConversation: async (id, title) => {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      set((state) => ({
        conversations: state.conversations.map(c => c.id === id ? { ...c, title } : c)
      }));
    } catch (e) {
      console.error('Failed to rename conversation', e);
    }
  },

  sendMessage: async (content: string, workspaceId: string, knowledgeBaseId?: string, documentId?: string) => {
    const { activeConversationId, createConversation } = get();
    let conversationId = activeConversationId;
    
    // If no active conversation, create one first
    if (!conversationId) {
      try {
        conversationId = await createConversation(content.substring(0, 30), workspaceId, knowledgeBaseId, documentId);
      } catch (e) {
        console.error('Failed to init conversation for message', e);
        return;
      }
    }

    // Optimistically add user message
    const userMsgId = crypto.randomUUID();
    get().addMessage({ id: userMsgId, role: 'user', content });
    get().setGenerating(true);

    // Optimistically add assistant streaming placeholder
    const astMsgId = crypto.randomUUID();
    get().addMessage({ id: astMsgId, role: 'assistant', content: '', isStreaming: true });

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      if (!res.body) throw new Error('No response body');

      // Check if conversation title changed
      get().loadConversations(workspaceId); // Refresh list to get new title

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        
        const lines = chunkValue.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).replace(/\r$/, '');
            if (dataStr === '[DONE]') {
              done = true;
              break;
            }
            try {
              const json = JSON.parse(dataStr);
              if (json.event === 'citations') {
                get().setCitationsToLastMessage(json.data);
              } else {
                get().appendStreamToLastMessage(dataStr);
              }
            } catch {
              if (dataStr && !dataStr.startsWith('{')) {
                get().appendStreamToLastMessage(dataStr);
              }
            }
          }
        }
      }

      // Finish streaming
      set((state) => ({
        messages: state.messages.map(msg => 
          msg.id === astMsgId ? { ...msg, isStreaming: false } : msg
        )
      }));

    } catch (e) {
      console.error('Streaming error:', e);
      get().appendStreamToLastMessage(" Sorry, I encountered an error while processing your request.");
    } finally {
      get().setGenerating(false);
    }
  },

  setGenerating: (generating) => set({ isGenerating: generating }),
  
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),

  appendStreamToLastMessage: (chunk) => set((state) => {
    const newMessages = [...state.messages];
    const lastMessage = newMessages[newMessages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.content += chunk;
    }
    return { messages: newMessages };
  }),

  setCitationsToLastMessage: (citations) => set((state) => {
    const newMessages = [...state.messages];
    const lastMessage = newMessages[newMessages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.citations = citations;
    }
    return { messages: newMessages };
  }),

}));
