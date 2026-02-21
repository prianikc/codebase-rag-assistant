/** Centralized localStorage key constants */

export const STORAGE_KEYS = {
    SESSIONS: 'rag_app_sessions',
    CURRENT_ID: 'rag_app_current_id',
    THEME: 'rag_app_theme',
    SPEECH: 'rag_app_speech',
    LLM_CONFIG: 'rag_app_llm_config',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
