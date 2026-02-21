/** LLM configuration types */

export type LlmProvider = 'gemini' | 'openai';

export interface GeminiConfig {
    apiKey: string;
    chatModel: string;
    embeddingModel: string;
}

export interface OpenAiEndpointConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface LlmConfig {
    chatProvider: LlmProvider;
    embeddingProvider: LlmProvider;
    gemini: GeminiConfig;
    openaiChat: OpenAiEndpointConfig;
    openaiEmbedding: OpenAiEndpointConfig;
}

export interface ProviderInfo {
    id: string;
    name: string;
    icon: string;
    color: string;
    apiKeyUrl: string;
    apiKeyLabel: string;
    baseUrl: string;
    provider: LlmProvider;
    chatModels: string[];
    embeddingModels: string[];
    description: string;
}

export interface LlmMessage {
    role: string;
    content: string;
}
