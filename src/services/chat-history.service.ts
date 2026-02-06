import { Injectable, signal, computed, effect } from '@angular/core';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: { path: string, score: number }[]; 
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastUpdate: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatHistoryService {
  private readonly STORAGE_KEY = 'rag_app_sessions';
  private readonly CURRENT_ID_KEY = 'rag_app_current_id';

  // Signals
  public sessions = signal<ChatSession[]>([]);
  public currentSessionId = signal<string | null>(null);

  public currentSession = computed(() => 
    this.sessions().find(s => s.id === this.currentSessionId()) || null
  );

  constructor() {
    this.loadFromStorage();

    // Auto-save effect
    effect(() => {
      const data = JSON.stringify(this.sessions());
      localStorage.setItem(this.STORAGE_KEY, data);
      
      if (this.currentSessionId()) {
        localStorage.setItem(this.CURRENT_ID_KEY, this.currentSessionId()!);
      }
    });

    // Ensure at least one session exists
    if (this.sessions().length === 0) {
      this.createNewSession();
    }
  }

  createNewSession() {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      lastUpdate: Date.now()
    };
    
    this.sessions.update(prev => [newSession, ...prev]);
    this.currentSessionId.set(newSession.id);
  }

  deleteSession(id: string) {
    this.sessions.update(prev => prev.filter(s => s.id !== id));
    
    // If we deleted the active session, switch to another or create new
    if (this.currentSessionId() === id) {
      const remaining = this.sessions();
      if (remaining.length > 0) {
        this.currentSessionId.set(remaining[0].id);
      } else {
        this.createNewSession();
      }
    }
  }

  selectSession(id: string) {
    this.currentSessionId.set(id);
  }

  addMessageToCurrent(message: ChatMessage) {
    const currentId = this.currentSessionId();
    if (!currentId) return;

    this.sessions.update(prev => prev.map(session => {
      if (session.id === currentId) {
        // Auto-generate title from first user message if it's "New Chat"
        let newTitle = session.title;
        if (session.messages.length === 0 && message.role === 'user') {
          newTitle = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
        }

        return {
          ...session,
          title: newTitle,
          messages: [...session.messages, message],
          lastUpdate: Date.now()
        };
      }
      return session;
    }));
  }

  updateLastMessage(content: string) {
    const currentId = this.currentSessionId();
    if (!currentId) return;

    this.sessions.update(prev => prev.map(session => {
      if (session.id === currentId) {
        const msgs = [...session.messages];
        if (msgs.length > 0) {
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
        }
        return { ...session, messages: msgs };
      }
      return session;
    }));
  }

  clearAll() {
    this.sessions.set([]);
    this.createNewSession();
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Fix dates if necessary (JSON parses dates as strings)
        // We actully store timestamps as numbers in interface to avoid serialization issues, 
        // but ChatMessage has Date.
        // Let's ensure messages structure is correct.
        this.sessions.set(parsed);
      }

      const lastId = localStorage.getItem(this.CURRENT_ID_KEY);
      if (lastId && this.sessions().some(s => s.id === lastId)) {
        this.currentSessionId.set(lastId);
      } else if (this.sessions().length > 0) {
        this.currentSessionId.set(this.sessions()[0].id);
      }
    } catch (e) {
      console.error('Failed to load history', e);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}
