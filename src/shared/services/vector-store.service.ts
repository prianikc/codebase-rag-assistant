import { Injectable, signal, computed, inject } from '@angular/core';
import { cosineSimilarity } from '@/src/core/utils';
import { IndexedDbService } from './indexed-db.service';
import type { VectorDocument, SearchResult } from '@/src/core/models';

// Re-export for backward compatibility
export type { VectorDocument, SearchResult } from '../../core/models/vector.model';

@Injectable({
    providedIn: 'root'
})
export class VectorStoreService {
    private dbService = inject(IndexedDbService);

    // The "Database"
    private documents = signal<VectorDocument[]>([]);

    // Track which model was used to generate these vectors
    // Format: "provider:model-name"
    private storeSignature = signal<string>('');

    public docCount = computed(() => this.documents().length);
    public memoryUsage = computed(() => {
        // Rough estimate (vectors + text)
        const count = this.docCount();
        if (count === 0) return '0.00 MB';

        // Estimate: ~4KB per doc average?
        const size = count * 4000;
        return (size / 1024 / 1024).toFixed(2) + ' MB';
    });

    constructor() {
        this.restoreFromDb();
    }

    async restoreFromDb() {
        try {
            const [docs, signature] = await Promise.all([
                this.dbService.getAllDocuments(),
                this.dbService.getMeta('storeSignature')
            ]);

            if (docs && docs.length > 0) {
                console.log(`[VectorStore] Restored ${docs.length} vectors from DB.`);
                this.documents.set(docs);
                if (signature) {
                    this.storeSignature.set(signature);
                }
            }
        } catch (e) {
            console.error('[VectorStore] Failed to restore from DB', e);
        }
    }

    async addDocuments(docs: VectorDocument[], signature: string) {
        // 1. Update In-Memory
        if (this.documents().length === 0) {
            this.storeSignature.set(signature);
            await this.dbService.saveMeta('storeSignature', signature);
        }

        this.documents.update(current => [...current, ...docs]);

        // 2. Persist to DB (Async, don't block too long)
        this.dbService.saveDocuments(docs).catch(e => {
            console.error('[VectorStore] Failed to save to DB', e);
        });
    }

    async clear() {
        this.documents.set([]);
        this.storeSignature.set('');
        await Promise.all([
            this.dbService.clearDocuments(),
            this.dbService.saveMeta('storeSignature', '')
        ]);
    }

    getStoreSignature(): string {
        return this.storeSignature();
    }

    // Expose for knowledge base to rebuild tree
    getAllDocuments() {
        return this.documents();
    }

    similaritySearch(queryEmbedding: number[], topK: number = 10, minScore: number = 0.0): SearchResult[] {
        const docs = this.documents();
        if (docs.length === 0) return [];

        // Calculate scores
        const scoredDocs = docs.map(doc => ({
            doc,
            score: cosineSimilarity(queryEmbedding, doc.embedding)
        }));

        // Filter by minScore and Sort descending
        const filteredAndSorted = scoredDocs
            .filter(item => item.score >= minScore)
            .sort((a, b) => b.score - a.score);

        // Return top K
        return filteredAndSorted.slice(0, topK);
    }
}
