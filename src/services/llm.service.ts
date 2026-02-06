import { Injectable, signal } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

export type LlmProvider = 'gemini' | 'lm-studio';

export interface LlmConfig {
  // Split providers for Hybrid Mode
  chatProvider: LlmProvider;
  embeddingProvider: LlmProvider;
  
  // LM Studio / OpenAI Compatible Settings
  lmStudioUrl: string; 
  lmStudioChatModel: string;
  lmStudioEmbeddingModel: string;

  // Gemini Settings
  geminiChatModel: string;
  geminiEmbeddingModel: string;

  // Retrieval Settings
  minRelevanceScore: number; // 0.0 to 1.0
}

@Injectable({
  providedIn: 'root'
})
export class LlmService {
  // Configuration State
  config = signal<LlmConfig>({
    chatProvider: 'gemini',
    embeddingProvider: 'gemini', // Can be switched to 'lm-studio' independently
    
    // LM Studio Defaults
    lmStudioUrl: 'http://localhost:1234/v1',
    lmStudioChatModel: 'local-model', 
    lmStudioEmbeddingModel: 'text-embedding-nomic-embed-text-v1.5',
    
    // Gemini Defaults
    geminiChatModel: 'gemini-2.5-flash',
    geminiEmbeddingModel: 'text-embedding-004',
    
    minRelevanceScore: 0.45 // Default to 45% similarity
  });

  private geminiClient: GoogleGenAI;

  constructor() {
    const apiKey = this.getApiKey();
    this.geminiClient = new GoogleGenAI({ apiKey: apiKey || 'MISSING_KEY_PLACEHOLDER' });
  }

  updateConfig(newConfig: Partial<LlmConfig>) {
    this.config.update(c => ({ ...c, ...newConfig }));
  }

  private getApiKey(): string {
    if (typeof process !== 'undefined' && process.env && process.env['API_KEY']) {
      return process.env['API_KEY'];
    }
    const win = (typeof window !== 'undefined') ? window as any : undefined;
    if (win && win.process && win.process.env && win.process.env.API_KEY) {
      return win.process.env.API_KEY;
    }
    return '';
  }

  // --- EMBEDDINGS ---

  async getEmbedding(text: string): Promise<number[]> {
    const conf = this.config();
    
    // Use the specific Embedding Provider setting
    if (conf.embeddingProvider === 'gemini') {
      const apiKey = this.getApiKey();
      if (!apiKey || apiKey === 'MISSING_KEY_PLACEHOLDER') {
        throw new Error("Gemini API Key is missing. Check environment variables.");
      }

      try {
        const response = await this.geminiClient.models.embedContent({
          model: conf.geminiEmbeddingModel,
          contents: text,
        });
        return response.embeddings?.[0]?.values || [];
      } catch (e: any) {
        console.error("Gemini Embedding Error", e);
        throw new Error(`Gemini Error (${conf.geminiEmbeddingModel}): ${e.message || e}`);
      }
    } else {
      // LM Studio / Local
      try {
        const response = await fetch(`${conf.lmStudioUrl}/embeddings`, {
          method: 'POST',
          mode: 'cors', // Explicitly request CORS
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: text,
            model: conf.lmStudioEmbeddingModel 
          })
        });
        
        if (!response.ok) {
           const errText = await response.text();
           throw new Error(`LM Studio Error (${response.status}): ${errText}`);
        }
        
        const data = await response.json();
        return data.data[0].embedding;
      } catch (e: any) {
        const msg = e.message || String(e);
        if (msg.includes('Failed to fetch')) {
             throw new Error(`Connection to Local Model failed (${conf.lmStudioUrl}). If using HTTPS, ensure Mixed Content is allowed or use a Tunnel.`);
        }
        console.error("LM Studio Embedding Error.", e);
        throw e;
      }
    }
  }

  // --- GENERATION ---

  async generateCompletion(messages: { role: string, content: string }[], systemInstruction?: string): Promise<string> {
    const conf = this.config();

    // Use the specific Chat Provider setting
    if (conf.chatProvider === 'gemini') {
      const apiKey = this.getApiKey();
      if (!apiKey || apiKey === 'MISSING_KEY_PLACEHOLDER') {
         throw new Error("Gemini API Key is missing. Check environment variables.");
      }

      const lastMsg = messages[messages.length - 1].content;
      
      const response = await this.geminiClient.models.generateContent({
        model: conf.geminiChatModel,
        contents: lastMsg,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3
        }
      });
      return response.text || '';

    } else {
      // LM Studio / Local Chat
      const apiMessages = [
        { role: 'system', content: systemInstruction || 'You are a helpful coding assistant.' },
        ...messages
      ];

      try {
        const response = await fetch(`${conf.lmStudioUrl}/chat/completions`, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: conf.lmStudioChatModel, 
            messages: apiMessages,
            temperature: 0.3,
            stream: false
          })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`LM Studio Chat Error (${response.status}): ${errText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (e: any) {
        const msg = e.message || String(e);
        if (msg.includes('Failed to fetch')) {
             throw new Error(`Connection to Local Model failed (${conf.lmStudioUrl}). Is it running?`);
        }
        throw e;
      }
    }
  }
}
