import { Injectable, signal } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

export type LlmProvider = 'gemini' | 'openai';

export interface LlmConfig {
  // Master Switches
  chatProvider: LlmProvider;
  embeddingProvider: LlmProvider;

  // --- CONFIGURATIONS ---
  // Now we treat them more similarly in the UI, but store distinct data 
  // to avoid overwriting a user's local URL with a cloud URL when switching presets.

  gemini: {
    apiKey: string; 
    chatModel: string;
    embeddingModel: string;
  };

  openaiChat: {
    baseUrl: string;      
    apiKey: string;       
    model: string;    
  };

  openaiEmbedding: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LlmService {
  public readonly MIN_RELEVANCE_SCORE = 0.55;

  // Default Configuration
  config = signal<LlmConfig>({
    chatProvider: 'gemini',
    embeddingProvider: 'openai', 
    
    gemini: {
      apiKey: '', // User will input this manually now
      chatModel: 'gemini-2.5-flash',
      embeddingModel: 'text-embedding-004',
    },

    openaiChat: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o',
    },

    openaiEmbedding: {
      baseUrl: 'http://localhost:11434/v1', 
      apiKey: '',
      model: 'nomic-embed-text',
    }
  });

  constructor() {}

  updateConfig(newConfig: Partial<LlmConfig>) {
    this.config.update(c => ({ ...c, ...newConfig }));
  }

  // --- HELPERS ---

  private getGeminiKey(): string {
    const c = this.config().gemini;
    // 1. Priority: Manual Input
    if (c.apiKey && c.apiKey.trim()) return c.apiKey; 
    
    // 2. Fallback: Environment Variable (for dev convenience)
    if (typeof process !== 'undefined' && process.env && process.env['API_KEY']) {
      return process.env['API_KEY'];
    }
    const win = (typeof window !== 'undefined') ? window as any : undefined;
    if (win && win.process && win.process.env && win.process.env.API_KEY) {
      return win.process.env.API_KEY;
    }
    return '';
  }

  private getGeminiClient(): GoogleGenAI {
    const key = this.getGeminiKey();
    if (!key) {
      console.warn("Gemini API Key is missing. Please enter it in settings.");
    }
    return new GoogleGenAI({ apiKey: key || 'MISSING_KEY' });
  }

  // --- EMBEDDINGS ---

  async getEmbedding(text: string): Promise<number[]> {
    const conf = this.config();
    const provider = conf.embeddingProvider;

    if (provider === 'gemini') {
      const client = this.getGeminiClient();
      try {
        const response = await client.models.embedContent({
          model: conf.gemini.embeddingModel,
          contents: text,
        });
        return response.embeddings?.[0]?.values || [];
      } catch (e: any) {
        throw new Error(`Gemini Embedding Error: ${e.message || e}`);
      }
    } else {
      // OPENAI COMPATIBLE (Local or Remote)
      return this.fetchOpenAiCompatibleEmbedding(
        text,
        conf.openaiEmbedding.baseUrl,
        conf.openaiEmbedding.apiKey,
        conf.openaiEmbedding.model
      );
    }
  }

  private async fetchOpenAiCompatibleEmbedding(text: string, baseUrl: string, apiKey: string, model: string): Promise<number[]> {
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json' 
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const url = `${cleanBase}/embeddings`;
      
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers,
        body: JSON.stringify({
          input: text,
          model: model
        })
      });
      
      if (!response.ok) {
         const errText = await response.text();
         throw new Error(`Embedding API Error (${response.status}): ${errText}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
    } catch (e: any) {
      if (String(e).includes('Failed to fetch')) {
           throw new Error(`Connection failed to ${baseUrl}. Check URL and CORS.`);
      }
      throw e;
    }
  }

  // --- GENERATION (STREAMING) ---

  async *generateCompletionStream(
    messages: { role: string, content: string }[], 
    systemInstruction?: string
  ): AsyncGenerator<string, void, unknown> {
    const conf = this.config();
    const provider = conf.chatProvider;

    if (provider === 'gemini') {
      const client = this.getGeminiClient();
      
      const geminiContents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
      
      try {
        const responseStream = await client.models.generateContentStream({
          model: conf.gemini.chatModel,
          contents: geminiContents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.3
          }
        });

        for await (const chunk of responseStream) {
          if (chunk.text) yield chunk.text;
        }
      } catch (error: any) {
        throw error;
      }

    } else {
      // OPENAI COMPATIBLE (Chat)
      const { baseUrl, apiKey, model } = conf.openaiChat;

      const apiMessages = [
        { role: 'system', content: systemInstruction || 'You are a helpful coding assistant.' },
        ...messages
      ];

      const headers: Record<string, string> = { 
        'Content-Type': 'application/json' 
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const url = `${cleanBase}/chat/completions`;

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          headers,
          body: JSON.stringify({
            model: model, 
            messages: apiMessages,
            temperature: 0.3,
            stream: true
          })
        });
      } catch (e: any) {
         throw new Error(`Connection failed to ${baseUrl}. Check URL/Internet.`);
      }

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
      }
      
      if (!response.body) throw new Error('ReadableStream not supported.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; 

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            
            const dataStr = trimmed.slice(6); 
            if (dataStr === '[DONE]') continue;

            try {
              const json = JSON.parse(dataStr);
              const content = json.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch (parseError) {
              // ignore invalid chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  }

  async generateCompletion(messages: { role: string, content: string }[], systemInstruction?: string): Promise<string> {
    let fullText = '';
    for await (const chunk of this.generateCompletionStream(messages, systemInstruction)) {
      fullText += chunk;
    }
    return fullText;
  }
}