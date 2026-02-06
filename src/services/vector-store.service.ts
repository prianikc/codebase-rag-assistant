import { Injectable, signal, computed } from '@angular/core';
import { cosineSimilarity } from './vector-utils';

export interface VectorDocument {
  id: string;
  filePath: string;
  content: string;
  embedding: number[];
  metadata?: any;
}

export interface SearchResult {
  doc: VectorDocument;
  score: number;
}

@Injectable({
  providedIn: 'root'
})
export class VectorStoreService {
  // The "Database"
  private documents = signal<VectorDocument[]>([]);
  
  // Track which model was used to generate these vectors
  // Format: "provider:model-name"
  private storeSignature = signal<string>('');

  public docCount = computed(() => this.documents().length);
  public memoryUsage = computed(() => {
    // Rough estimate
    const json = JSON.stringify(this.documents());
    return (json.length / 1024 / 1024).toFixed(2) + ' MB';
  });

  addDocuments(docs: VectorDocument[], signature: string) {
    // If store is empty, set signature. If not, we theoretically should check consistency,
    // but for now we assume a clear() happened before a major ingest or appended with same model.
    if (this.documents().length === 0) {
      this.storeSignature.set(signature);
    }
    this.documents.update(current => [...current, ...docs]);
  }

  clear() {
    this.documents.set([]);
    this.storeSignature.set('');
  }

  getStoreSignature(): string {
    return this.storeSignature();
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
