import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: any[];
  isStreaming?: boolean;
  createdAt?: string;
  needsConfirmation?: { pendingId: string; verdict: string; reason: string; goodDocsCount: number } | null;
  confirmationResolved?: boolean;
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
  setConfirmationOnLastMessage: (data: { pending_id: string; verdict: string; reason: string; good_docs_count: number }) => void;
  resolveWebSearch: (conversationId: string, pendingId: string, consent: boolean) => Promise<void>;
  _consumeSSEStream: (res: Response, astMsgId: string) => Promise<void>;
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
    const { activeConversationId, createConversation, messages, resolveWebSearch, addMessage } = get();

    // Check for pending web search confirmation
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMessage?.needsConfirmation && !lastAssistantMessage.confirmationResolved && activeConversationId) {
      const normalized = content.toLowerCase().trim().replace(/[.,!?;]+$/, '');
      const affirmative = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'do it', 'search', 'ya', 'y', 'go ahead', 'please'];
      const negative = ['no', 'nope', 'nah', "don't", 'stop', 'cancel', 'n'];
      
      if (affirmative.includes(normalized)) {
        addMessage({ id: crypto.randomUUID(), role: 'user', content });
        await resolveWebSearch(activeConversationId, lastAssistantMessage.needsConfirmation.pendingId, true);
        return;
      } else if (negative.includes(normalized)) {
        addMessage({ id: crypto.randomUUID(), role: 'user', content });
        await resolveWebSearch(activeConversationId, lastAssistantMessage.needsConfirmation.pendingId, false);
        return;
      }
    }

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

      await get()._consumeSSEStream(res, astMsgId);

    } catch (e) {
      console.error('Streaming error:', e);
      get().appendStreamToLastMessage(" Sorry, I encountered an error while processing your request.");
    } finally {
      get().setGenerating(false);
    }
  },
  
  _consumeSSEStream: async (res: Response, astMsgId: string) => {
    if (!res.body) return;
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
            if (json && typeof json === 'object') {
              if (json.event === 'citations') {
                get().setCitationsToLastMessage(json.data);
              } else if (json.event === 'needs_confirmation') {
                get().setConfirmationOnLastMessage(json.data);
              } else if (typeof json === 'string') {
                get().appendStreamToLastMessage(json);
              } else {
                get().appendStreamToLastMessage(dataStr);
              }
            } else if (typeof json === 'string') {
              get().appendStreamToLastMessage(json);
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
  },

  resolveWebSearch: async (conversationId: string, pendingId: string, consent: boolean) => {
    const { messages, setGenerating, _consumeSSEStream } = get();
    // Find the last assistant message
    const lastMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.needsConfirmation?.pendingId === pendingId);
    if (!lastMsg) return;

    // Optimistically hide the buttons
    set((state) => ({
      messages: state.messages.map(msg => 
        msg.id === lastMsg.id ? { ...msg, confirmationResolved: true, isStreaming: true } : msg
      )
    }));
    
    setGenerating(true);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId, consent }),
      });

      if (res.status === 410) {
        get().appendStreamToLastMessage("\n\nThis confirmation expired — please ask your question again.");
        set((state) => ({
          messages: state.messages.map(msg => 
            msg.id === lastMsg.id ? { ...msg, isStreaming: false } : msg
          )
        }));
        return;
      }

      await _consumeSSEStream(res, lastMsg.id);
    } catch (e) {
      console.error('Resolve error:', e);
      get().appendStreamToLastMessage("\n\nSorry, I encountered an error while resolving your request.");
    } finally {
      setGenerating(false);
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

  setConfirmationOnLastMessage: (data) => set((state) => {
    const newMessages = [...state.messages];
    const lastMessage = newMessages[newMessages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      // Map snake_case from backend to camelCase for frontend
      lastMessage.needsConfirmation = {
        pendingId: data.pending_id,
        verdict: data.verdict,
        reason: data.reason,
        goodDocsCount: data.good_docs_count,
      };
    }
    return { messages: newMessages };
  }),

}));
