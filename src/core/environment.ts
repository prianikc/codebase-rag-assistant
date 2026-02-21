export const environment = {
    production: false,
    appName: 'Codebase RAG Assistant',
    version: '1.0.0',
    defaults: {
        chatProvider: 'gemini' as const,
        embeddingProvider: 'openai' as const,
        minRelevanceScore: 0.55,
        concurrencyLimit: 4,
        downloadConcurrency: 10,
        chunkSize: { code: 500, data: 800 },
        chunkOverlap: { code: 50, data: 100 },
    },
    db: {
        name: 'RagAppVectorDb',
        version: 1,
    },
    storage: {
        sessionsKey: 'rag_app_sessions',
        currentIdKey: 'rag_app_current_id',
        themeKey: 'rag_app_theme',
    },
};
