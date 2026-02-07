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
}

@Injectable({
  providedIn: 'root'
})
export class LlmService {
  // Hardcoded "Best Solution" threshold
  // 0.55 filters out noise while keeping relevant code context
  public readonly MIN_RELEVANCE_SCORE = 0.55;

  // Configuration State
  config = signal<LlmConfig>({
    chatProvider: 'gemini',        // Default: Online Smart Model
    embeddingProvider: 'lm-studio', // Default: Local Embeddings (Privacy/Free)
    
    // LM Studio Defaults
    lmStudioUrl: 'http://localhost:1234/v1',
    lmStudioChatModel: 'local-model', 
    lmStudioEmbeddingModel: 'text-embedding-nomic-embed-text-v1.5',
    
    // Gemini Defaults
    geminiChatModel: 'gemini-2.5-flash',
    geminiEmbeddingModel: 'text-embedding-004',
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

  // --- GENERATION (STREAMING) ---

  async *generateCompletionStream(
    messages: { role: string, content: string }[], 
    systemInstruction?: string
  ): AsyncGenerator<string, void, unknown> {
    const conf = this.config();

    if (conf.chatProvider === 'gemini') {
      // --- GEMINI STREAMING ---
      const apiKey = this.getApiKey();
      if (!apiKey || apiKey === 'MISSING_KEY_PLACEHOLDER') {
         throw new Error("Gemini API Key is missing. Check environment variables.");
      }

      const geminiContents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
      
      try {
        const responseStream = await this.geminiClient.models.generateContentStream({
          model: conf.geminiChatModel,
          contents: geminiContents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.3
          }
        });

        for await (const chunk of responseStream) {
          const text = chunk.text;
          if (text) {
            yield text;
          }
        }
      } catch (error: any) {
        console.error("Gemini Streaming Error:", error);
        throw error;
      }

    } else {
      // --- LM STUDIO / LOCAL STREAMING ---
      const apiMessages = [
        { role: 'system', content: systemInstruction || 'You are a helpful coding assistant.' },
        ...messages
      ];

      let response: Response;
      try {
        response = await fetch(`${conf.lmStudioUrl}/chat/completions`, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: conf.lmStudioChatModel, 
            messages: apiMessages,
            temperature: 0.3,
            stream: true // Enable streaming
          })
        });
      } catch (e: any) {
        if (String(e).includes('Failed to fetch')) {
             throw new Error(`Connection to Local Model failed (${conf.lmStudioUrl}). Is it running?`);
        }
        throw e;
      }

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`LM Studio Chat Error (${response.status}): ${errText}`);
      }
      
      if (!response.body) throw new Error('ReadableStream not supported in this browser.');

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
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            
            const dataStr = trimmed.slice(6); // Remove 'data: '
            if (dataStr === '[DONE]') continue;

            try {
              const json = JSON.parse(dataStr);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (parseError) {
              console.warn('Error parsing SSE JSON', parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  }

  // Keep non-streaming version for backward compatibility or simple tasks
  async generateCompletion(messages: { role: string, content: string }[], systemInstruction?: string): Promise<string> {
    let fullText = '';
    for await (const chunk of this.generateCompletionStream(messages, systemInstruction)) {
      fullText += chunk;
    }
    return fullText;
  }
}
