import { inject, Injectable } from '@angular/core';
import { KnowledgeBaseService, VectorStoreService, LlmService } from '../../../shared/services';

/**
 * Result of a RAG context retrieval.
 */
export interface RagContext {
    /** Formatted context block for the system prompt */
    contextBlock: string;
    /** Source files with relevance scores */
    sources: { path: string; score: number }[];
}

/**
 * Service responsible for RAG (Retrieval-Augmented Generation) logic:
 * searching the vector store, filtering by relevance, and building
 * context blocks for LLM prompts.
 */
@Injectable({ providedIn: 'root' })
export class RagService {
    private kbService = inject(KnowledgeBaseService);
    private vectorStore = inject(VectorStoreService);
    private llmService = inject(LlmService);

    /**
     * Retrieve relevant context from the vector store for a given query.
     * Returns formatted context and source references.
     */
    async retrieveContext(query: string): Promise<RagContext> {
        const userMinScore = this.llmService.MIN_RELEVANCE_SCORE;
        const rawChunks = await this.kbService.search(query, 40, 0.0);
        const relevantChunks = rawChunks.filter(c => c.score >= userMinScore);

        let contextBlock = '';
        let sources: { path: string; score: number }[] = [];

        if (rawChunks.length > 0 && relevantChunks.length === 0) {
            contextBlock = 'No high-quality code context found.';
        } else if (relevantChunks.length > 0) {
            // Deduplicate sources, keeping highest score per file
            const sourceMap = new Map<string, number>();
            relevantChunks.forEach(c => {
                const current = sourceMap.get(c.source) || 0;
                if (c.score > current) sourceMap.set(c.source, c.score);
            });

            sources = Array.from(sourceMap.entries())
                .map(([path, score]) => ({ path, score }))
                .sort((a, b) => b.score - a.score);

            contextBlock = relevantChunks.map(c =>
                `FILENAME: ${c.source} (Match: ${(c.score * 100).toFixed(0)}%)\nCONTENT:\n${c.content}\n---`
            ).join('\n');
        } else {
            contextBlock = 'No specific code context found (Low similarity scores).';

            if (query.toLowerCase().includes('project') || query.toLowerCase().includes('structure')) {
                const fileTree = this.kbService.filePaths().slice(0, 200).join('\n');
                contextBlock += `\n\nExisting File Structure:\n${fileTree}`;
            }
        }

        return { contextBlock, sources };
    }

    /**
     * Build a system prompt with or without RAG context.
     */
    buildSystemPrompt(userQuery: string, ragContext: RagContext | null): string {
        let systemPrompt = 'You are an advanced software engineer.';

        if (ragContext && ragContext.contextBlock) {
            systemPrompt += `
User Query: ${userQuery}

Here is the retrieved code context from the vector database:
${ragContext.contextBlock}

Instructions:
- The context consists of smaller code snippets.
- Use the context to answer the query accurately.
- If the context contains the answer, cite the filename.
- If the context is irrelevant, answer based on general knowledge but mention that context was missing.
`;
        } else {
            systemPrompt += `
User Query: ${userQuery}
Note: No code context provided (files not loaded or RAG disabled). Answer based on general knowledge.
`;
        }

        return systemPrompt;
    }

    /** Whether there are documents available for RAG */
    get hasDocuments(): boolean {
        return this.vectorStore.docCount() > 0;
    }
}
