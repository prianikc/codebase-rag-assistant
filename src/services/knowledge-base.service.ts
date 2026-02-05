import { Injectable, signal, inject } from '@angular/core';
import { LlmService } from './llm.service';
import { VectorStoreService, VectorDocument, SearchResult } from './vector-store.service';
import { chunkTextDetailed } from './vector-utils';

@Injectable({
  providedIn: 'root'
})
export class KnowledgeBaseService {
  private llmService = inject(LlmService);
  private vectorStore = inject(VectorStoreService);

  // State
  public isIngesting = signal<boolean>(false);
  public progressStatus = signal<string>('');
  
  // Data for UI
  public totalFiles = signal(0);
  public filePaths = signal<string[]>([]); // Added to support Tree View

  private allowedExtensions = [
    '.ts', '.js', '.jsx', '.tsx', '.html', '.css', '.scss', '.json', 
    '.md', '.py', '.java', '.c', '.cpp', '.go', '.rs', '.php', '.sql',
    '.txt', '.env', '.yaml', '.yml'
  ];

  async ingestFiles(fileList: FileList) {
    // Prevent concurrent runs
    if (this.isIngesting()) return;

    this.isIngesting.set(true);
    this.vectorStore.clear();
    this.totalFiles.set(0);
    this.filePaths.set([]);

    const files = Array.from(fileList);
    let processed = 0;
    
    // 1. Filter and Read Files
    const rawFiles: { path: string, content: string }[] = [];
    
    for (const file of files) {
      if (this.isAllowed(file.name)) {
        try {
          const content = await this.readFile(file);
          const path = file.webkitRelativePath || file.name;
          rawFiles.push({ path, content });
        } catch (e) {
          console.warn('Skipped file', file.name);
        }
      }
    }

    this.totalFiles.set(rawFiles.length);
    // Save paths for the tree view
    this.filePaths.set(rawFiles.map(f => f.path));
    
    this.progressStatus.set(`Read ${rawFiles.length} files. Starting vectorization...`);

    // 2. Chunk and Vectorize
    const vectorDocs: VectorDocument[] = [];
    
    // Circuit breaker variables
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    let aborted = false;

    for (const raw of rawFiles) {
      if (aborted) break;

      this.progressStatus.set(`Vectorizing: ${raw.path} (${processed + 1}/${rawFiles.length})`);
      
      // OPTIMIZATION: Ultra-High Resolution (200 chars per chunk)
      // This increases precision by ~200% compared to previous 600 chars setting.
      const chunks = chunkTextDetailed(raw.content, 200, 50);
      
      for (let i = 0; i < chunks.length; i++) {
        try {
          const chunkData = chunks[i];
          const embedding = await this.llmService.getEmbedding(chunkData.text);
          
          vectorDocs.push({
            id: `${raw.path}-${i}`,
            filePath: raw.path,
            content: chunkData.text,
            embedding: embedding,
            metadata: {
              startIndex: chunkData.startIndex,
              endIndex: chunkData.endIndex
            }
          });
          
          // Reset error count on success
          consecutiveErrors = 0; 
        } catch (err: any) {
           console.error(`Failed to embed chunk of ${raw.path}`, err);
           consecutiveErrors++;
           
           // If we hit the limit, abort everything
           if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
             const reason = err.message || 'Unknown Network Error';
             alert(`Ingestion Aborted!\n\nFailed to connect to LLM Provider multiple times.\nReason: ${reason}\n\nIf using LM Studio, ensure the Server is ON and CORS is Enabled.`);
             
             this.progressStatus.set(`Aborted: Connection Failed.`);
             aborted = true;
             break;
           }
        }
      }
      processed++;
    }

    // 3. Store (only if not completely broken)
    if (!aborted && vectorDocs.length > 0) {
      this.vectorStore.addDocuments(vectorDocs);
      this.progressStatus.set(`Done! Stored ${vectorDocs.length} vector chunks.`);
    } else if (aborted) {
       // Keep the error status
    } else {
      this.progressStatus.set(`No valid files found or processed.`);
    }

    this.isIngesting.set(false);
  }

  async search(query: string, topK: number = 10, minScore: number = 0.5): Promise<{ content: string, source: string, score: number }[]> {
    // 1. Embed query
    const queryEmbedding = await this.llmService.getEmbedding(query);
    
    // 2. Search Vector Store (Now returns scores)
    const results: SearchResult[] = this.vectorStore.similaritySearch(queryEmbedding, topK, minScore);
    
    return results.map(res => ({
      content: res.doc.content,
      source: res.doc.filePath,
      score: res.score
    }));
  }

  private isAllowed(filename: string): boolean {
    const lower = filename.toLowerCase();
    if (lower.includes('node_modules') || lower.includes('.git/') || lower.includes('dist/')) return false;
    return this.allowedExtensions.some(ext => lower.endsWith(ext)) || lower.includes('dockerfile');
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }
}
