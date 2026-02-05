import { Injectable, signal, computed } from '@angular/core';
import { cosineSimilarity } from './vector-utils';

export interface VectorDocument {
  id: string;
  filePath: string;
  content: string;
  embedding: number[];
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class VectorStoreService {
  // The "Database"
  private documents = signal<VectorDocument[]>([]);
  
  public docCount = computed(() => this.documents().length);
  public memoryUsage = computed(() => {
    // Rough estimate
    const json = JSON.stringify(this.documents());
    return (json.length / 1024 / 1024).toFixed(2) + ' MB';
  });

  addDocuments(docs: VectorDocument[]) {
    this.documents.update(current => [...current, ...docs]);
  }

  clear() {
    this.documents.set([]);
  }

  similaritySearch(queryEmbedding: number[], topK: number = 4): VectorDocument[] {
    const docs = this.documents();
    if (docs.length === 0) return [];

    // Calculate scores
    const scoredDocs = docs.map(doc => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    // Sort descending
    scoredDocs.sort((a, b) => b.score - a.score);

    // Return top K
    return scoredDocs.slice(0, topK).map(item => item.doc);
  }
}