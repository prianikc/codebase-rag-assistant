/** Speech (STT/TTS) configuration types */

export type SttProvider = 'browser' | 'openai' | 'groq';
export type TtsProvider = 'browser' | 'openai' | 'elevenlabs';

export interface SpeechConfig {
    stt: SttConfig;
    tts: TtsConfig;
}

export interface SttConfig {
    provider: SttProvider;
    apiKey: string;
    model: string;
    baseUrl: string;
    language: string;
}

export interface TtsConfig {
    provider: TtsProvider;
    apiKey: string;
    model: string;
    voice: string;
    baseUrl: string;
    rate: number;
}

export const DEFAULT_STT_CONFIG: SttConfig = {
    provider: 'browser',
    apiKey: '',
    model: 'whisper-1',
    baseUrl: 'https://api.openai.com/v1',
    language: 'ru-RU',
};

export const DEFAULT_TTS_CONFIG: TtsConfig = {
    provider: 'browser',
    apiKey: '',
    model: 'tts-1',
    voice: 'alloy',
    baseUrl: 'https://api.openai.com/v1',
    rate: 1.0,
};
