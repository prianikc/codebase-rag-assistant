import { Injectable, signal } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

export type LlmProvider = 'gemini' | 'openai';

export interface LlmConfig {
  // We can mix and match providers
  chatProvider: LlmProvider;
  embeddingProvider: LlmProvider;

  // --- GENERIC OPENAI-COMPATIBLE CONFIG ---
  // Works with: OpenAI, Groq, DeepSeek, LM Studio, Ollama, vLLM, etc.
  openai: {
    baseUrl: string;      // e.g. "https://api.openai.com/v1" or "http://localhost:1234/v1"
    apiKey: string;       // "sk-..."
    chatModel: string;    // "gpt-4o", "llama-3", "mixtral-8x7b"
    embeddingModel: string; // "text-embedding-3-small", "nomic-embed-text"
  };

  // --- GOOGLE GEMINI CONFIG ---
  gemini: {
    apiKey: string; // If empty, tries process.env
    chatModel: string;
    embeddingModel: string;
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
    embeddingProvider: 'openai', // Default to OpenAI/Local for embeddings usually
    
    openai: {
      baseUrl: 'http://localhost:1234/v1',
      apiKey: '',
      chatModel: 'local-model', 
      embeddingModel: 'text-embedding-nomic-embed-text-v1.5',
    },
    
    gemini: {
      apiKey: '',
      chatModel: 'gemini-2.5-flash',
      embeddingModel: 'text-embedding-004',
    }
  });

  constructor() {}

  updateConfig(newConfig: Partial<LlmConfig>) {
    this.config.update(c => ({ ...c, ...newConfig }));
  }

  // --- HELPERS ---

  private getGeminiKey(): string {
    const c = this.config().gemini;
    if (c.apiKey) return c.apiKey; // User override
    
    // Fallback to env
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
      // OPENAI COMPATIBLE
      const { baseUrl, apiKey, embeddingModel } = conf.openai;
      
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json' 
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      try {
        // Handle trailing slash
        const url = baseUrl.endsWith('/') ? `${baseUrl}embeddings` : `${baseUrl}/embeddings`;
        
        const response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          headers,
          body: JSON.stringify({
            input: text,
            model: embeddingModel
          })
        });
        
        if (!response.ok) {
           const errText = await response.text();
           throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
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
      // OPENAI COMPATIBLE
      const { baseUrl, apiKey, chatModel } = conf.openai;

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

      const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          mode: 'cors',
          headers,
          body: JSON.stringify({
            model: chatModel, 
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