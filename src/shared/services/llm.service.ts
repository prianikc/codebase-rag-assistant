import { Injectable, signal } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { LlmConfig, LlmProvider, LlmMessage } from '../../core/models/llm.model';
import { parseApiError } from '../utils/error.utils';
import { EnvConfigService } from './env-config.service';

// Re-export for backward compatibility
export type { LlmConfig, LlmProvider, LlmMessage };

@Injectable({
    providedIn: 'root'
})
export class LlmService {
    public readonly MIN_RELEVANCE_SCORE = 0.55;

    // Default Configuration (LM Studio)
    config = signal<LlmConfig>({
        chatProvider: 'openai',
        embeddingProvider: 'openai',

        gemini: {
            apiKey: '',
            chatModel: 'gemini-2.5-flash',
            embeddingModel: 'text-embedding-004',
        },

        openaiChat: {
            baseUrl: 'http://localhost:1234/v1',
            apiKey: '',
            model: 'openai/gpt-oss-20b',
        },

        openaiEmbedding: {
            baseUrl: 'http://localhost:1234/v1',
            apiKey: '',
            model: 'text-embedding-mxbai-embed-large-v1',
        }
    });

    constructor(private envService: EnvConfigService) { }

    updateConfig(newConfig: Partial<LlmConfig>) {
        this.config.update(c => ({ ...c, ...newConfig }));
    }

    // --- HELPERS ---

    private getGeminiKey(): string {
        const c = this.config().gemini;
        // 1. Priority: Manual Input
        if (c.apiKey && c.apiKey.trim()) return c.apiKey;

        // 2. Fallback: Environment Variable (via EnvConfigService)
        return this.envService.getApiKey();
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
                let cleanMsg = `Embedding Error (${response.status})`;
                try { const p = JSON.parse(errText); if (p.error?.message) cleanMsg = p.error.message; else if (p.message) cleanMsg = p.message; } catch { cleanMsg += ': ' + errText.substring(0, 200); }
                throw new Error(cleanMsg);
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
                // Gemini SDK throws Error objects with raw JSON in .message
                // Extract the human-readable message
                let msg = 'Gemini API error';

                if (error?.message && typeof error.message === 'string') {
                    // Try to parse JSON from the message
                    try {
                        const jsonMatch = error.message.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.error?.message) {
                                msg = parsed.error.message;
                            } else if (parsed.message) {
                                msg = parsed.message;
                            } else {
                                msg = error.message.substring(0, 200);
                            }
                        } else {
                            msg = error.message.substring(0, 200);
                        }
                    } catch {
                        msg = error.message.substring(0, 200);
                    }
                } else if (error?.errorDetails && Array.isArray(error.errorDetails)) {
                    msg = error.errorDetails
                        .map((d: any) => d.reason || d.message || '')
                        .filter(Boolean)
                        .join('; ');
                }

                throw new Error(msg);
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
                let cleanMsg = `API Error (${response.status})`;
                try {
                    const parsed = JSON.parse(errText);
                    if (parsed.error?.message) cleanMsg = parsed.error.message;
                    else if (parsed.message) cleanMsg = parsed.message;
                    else cleanMsg += ': ' + errText.substring(0, 200);
                } catch {
                    cleanMsg += ': ' + errText.substring(0, 200);
                }
                throw new Error(cleanMsg);
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
