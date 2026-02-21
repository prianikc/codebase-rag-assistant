/** Chat domain types */

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    sources?: ChatSource[];
    timestamp: Date;
}

export interface ChatSource {
    path: string;
    score: number;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    lastUpdate: number;
}
