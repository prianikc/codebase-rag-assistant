import { Injectable, signal } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

export type LlmProvider = 'gemini' | 'lm-studio';

export interface LlmConfig {
  provider: LlmProvider;
  lmStudioUrl: string; // e.g. http://localhost:1234/v1
  lmStudioModel: string;
}

@Injectable({
  providedIn: 'root'
})
export class LlmService {
  // Configuration State
  config = signal<LlmConfig>({
    provider: 'gemini',
    lmStudioUrl: 'http://localhost:1234/v1',
    lmStudioModel: 'local-model' 
  });

  private geminiClient: GoogleGenAI;

  constructor() {
    // Safe access to process.env
    const apiKey = (typeof process !== 'undefined' && process.env) ? process.env['API_KEY'] : '';
    
    // FIX: The SDK throws if apiKey is empty string. 
    // We pass a placeholder if missing so the app can boot.
    // We will validate the key is real before making actual requests.
    this.geminiClient = new GoogleGenAI({ apiKey: apiKey || 'MISSING_KEY_PLACEHOLDER' });
  }

  updateConfig(newConfig: Partial<LlmConfig>) {
    this.config.update(c => ({ ...c, ...newConfig }));
  }

  private getApiKey(): string {
    return (typeof process !== 'undefined' && process.env) ? process.env['API_KEY'] || '' : '';
  }

  // --- EMBEDDINGS ---

  async getEmbedding(text: string): Promise<number[]> {
    const conf = this.config();
    
    if (conf.provider === 'gemini') {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please check your environment configuration or switch to LM Studio.");
      }

      try {
        const response = await this.geminiClient.models.embedContent({
          model: 'text-embedding-004',
          contents: text,
        });
        return response.embeddings?.[0]?.values || [];
      } catch (e) {
        console.error("Gemini Embedding Error", e);
        throw e;
      }
    } else {
      // LM Studio / OpenAI Compatible
      try {
        const response = await fetch(`${conf.lmStudioUrl}/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: text,
            model: conf.lmStudioModel 
          })
        });
        
        if (!response.ok) {
           throw new Error(`LM Studio Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.data[0].embedding;
      } catch (e: any) {
        // Provide specific advice for "Failed to fetch" (usually connection refused/CORS)
        const msg = e.message || String(e);
        if (msg.includes('Failed to fetch')) {
             throw new Error("Connection Refused. Is LM Studio running? Is CORS enabled?");
        }
        console.error("LM Studio Embedding Error.", e);
        throw e;
      }
    }
  }

  // --- GENERATION ---

  async generateCompletion(messages: { role: string, content: string }[], systemInstruction?: string): Promise<string> {
    const conf = this.config();

    if (conf.provider === 'gemini') {
      const apiKey = this.getApiKey();
      if (!apiKey) {
         throw new Error("Gemini API Key is missing. Please check your environment configuration.");
      }

      // Convert standard messages to Gemini format if needed, 
      // but generateContent simplifies this. We'll use the last user message + context approach 
      // or chat history. For this RAG implementation, we often send one big prompt.
      
      const lastMsg = messages[messages.length - 1].content;
      
      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: lastMsg,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3
        }
      });
      return response.text || '';

    } else {
      // LM Studio / OpenAI Compatible Chat Completion
      const apiMessages = [
        { role: 'system', content: systemInstruction || 'You are a helpful coding assistant.' },
        ...messages
      ];

      try {
        const response = await fetch(`${conf.lmStudioUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: conf.lmStudioModel,
            messages: apiMessages,
            temperature: 0.3,
            stream: false
          })
        });

        if (!response.ok) throw new Error(`LM Studio Chat Error: ${response.statusText}`);
        
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (e: any) {
        const msg = e.message || String(e);
        if (msg.includes('Failed to fetch')) {
             throw new Error("Connection Refused. Is LM Studio running? Is CORS enabled?");
        }
        throw e;
      }
    }
  }
}