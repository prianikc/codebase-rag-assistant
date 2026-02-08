import { Injectable, signal, inject, computed } from '@angular/core';
import { LlmService } from './llm.service';
import { VectorStoreService, VectorDocument } from './vector-store.service';
import { chunkTextDetailed } from './vector-utils';

@Injectable({
  providedIn: 'root'
})
export class KnowledgeBaseService {
  private llmService = inject(LlmService);
  private vectorStore = inject(VectorStoreService);

  // --- CONFIGURATION ---
  
  // 1. CONCURRENCY CONTROL
  // How many files to embed simultaneously. 
  // 3-5 is safe for Gemini/Local. Too high might trigger 429 Rate Limits.
  private readonly CONCURRENCY_LIMIT = 4;

  // 2. STRICTLY BLOCKED EXTENSIONS (Binaries, Media, Archives)
  // We keep this purely because "reading binaries as text" produces garbage for the LLM.
  private binaryExtensions = new Set([
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.avif', '.bmp', '.tiff', '.psd',
    // Audio/Video
    '.mp4', '.mp3', '.wav', '.ogg', '.webm', '.mov', '.avi', '.mkv', '.flac', '.aac',
    // Archives
    '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.iso', '.dmg',
    // Documents (Binary)
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    // Executables / Libs
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib', '.class', '.pyc', '.pyd',
    // Databases
    '.db', '.sqlite', '.sqlite3', '.mdb', '.parquet',
    // Misc
    '.ds_store', '.map', '.woff', '.woff2', '.ttf', '.eot', '.suo', '.ntvs', '.njsproj'
  ]);

  // 3. BLOCKED DIRECTORIES (Exact Match)
  // We skip these folders entirely to save time.
  private blockedDirNames = new Set([
    'node_modules', 
    '.git', 
    '.angular', 
    '.nx', 
    '.vscode', 
    '.idea', 
    'dist', 
    'build', 
    'out', 
    'coverage', 
    '.next', 
    '.nuxt', 
    '.cache', 
    '__pycache__', 
    'venv', 
    'target', 
    'vendor', 
    'bin', 
    'obj',
    '.gradle'
  ]);

  // 4. BLOCKED FILENAMES (Exact Match)
  private blockedFileNames = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
    'cargo.lock', 'gemfile.lock', 'composer.lock', 'poetry.lock',
    '.yarn-integrity', '.ds_store', 'thumbs.db'
  ]);

  // --- STATE ---
  public isIngesting = signal<boolean>(false);
  public progressStatus = signal<string>('');
  
  // Computed stats from VectorStore
  public filePaths = computed(() => {
    const docs = this.vectorStore.getAllDocuments();
    // distinct files
    const uniquePaths = new Set(docs.map(d => d.filePath));
    return Array.from(uniquePaths).sort();
  });

  public totalFiles = computed(() => this.filePaths().length);

  // --- API ---

  /**
   * Main Entry Point 1: File Input (Drag & Drop or Dialog)
   */
  async ingestFiles(filesInput: FileList | File[]) {
    // CRITICAL FIX: Ensure we have a standard array and snapshot it immediately
    const files = Array.isArray(filesInput) ? filesInput : Array.from(filesInput);
    
    console.log(`[KnowledgeBase] Received ${files.length} files. Starting ingestion...`);

    if (this.isIngesting()) return;
    this.isIngesting.set(true);
    
    try {
      this.progressStatus.set('Clearing old database...');
      await this.vectorStore.clear(); 
      
      this.progressStatus.set(`Scanning ${files.length} files...`);

      // 1. Filter & Read
      const validFiles: { path: string, content: string }[] = [];
      let skippedCount = 0;

      console.groupCollapsed('[KnowledgeBase] Filtering Analysis');
      
      for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        
        if (this.isAllowed(path)) {
           try {
             const content = await this.readFile(file);
             // Basic binary check: null bytes
             if (content.indexOf('\0') !== -1) {
                console.log(`Skipped (Binary Content): ${path}`);
                skippedCount++;
             } else if (!content.trim()) {
                console.log(`Skipped (Empty): ${path}`);
                skippedCount++;
             } else {
                validFiles.push({ path, content });
             }
           } catch (e) {
             console.warn(`Read Error: ${path}`, e);
           }
        } else {
          skippedCount++;
          // console.log(`Blocked: ${path}`);
        }
      }
      console.groupEnd();

      if (validFiles.length === 0) {
        throw new Error(`No valid text files found. Scanned ${files.length} files. Check if you selected a folder with only binaries or ignored folders.`);
      }

      // 2. Vectorize
      await this.processDocumentsOptimized(validFiles);

    } catch (err: any) {
      console.error(err);
      this.progressStatus.set(`Error: ${err.message}`);
      alert(`Ingestion Failed: ${err.message}`);
    } finally {
      this.isIngesting.set(false);
    }
  }

  /**
   * Main Entry Point 2: GitHub Repository
   */
  async ingestGitHubRepo(repoUrl: string) {
    if (this.isIngesting()) return;
    this.isIngesting.set(true);

    try {
      await this.vectorStore.clear();
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      
      this.progressStatus.set(`Fetching GitHub Tree for ${owner}/${repo}...`);

      // 1. Get Tree
      let branch = 'main';
      let treeData = await this.fetchGitTree(owner, repo, branch);
      if (!treeData) {
        branch = 'master';
        treeData = await this.fetchGitTree(owner, repo, branch);
      }
      if (!treeData) throw new Error('Could not find branch main or master.');

      // 2. Filter Blob Nodes
      const blobNodes = treeData.tree.filter((node: any) => 
        node.type === 'blob' && this.isAllowed(node.path)
      );

      if (blobNodes.length === 0) throw new Error('No valid source files found in repository.');

      this.progressStatus.set(`Found ${blobNodes.length} files. Downloading...`);

      // 3. Parallel Download
      const validFiles: { path: string, content: string }[] = [];
      const DOWNLOAD_CONCURRENCY = 10;
      
      await this.runConcurrent(blobNodes, DOWNLOAD_CONCURRENCY, async (node: any) => {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${node.path}`;
          try {
            const content = await this.fetchText(rawUrl);
            if (content && !content.includes('\0')) { // Simple binary check
               validFiles.push({ path: node.path, content });
            }
          } catch (e) {
            console.warn(`Failed to download ${node.path}`);
          }
          this.progressStatus.set(`Downloading: ${validFiles.length}/${blobNodes.length}`);
      });

      // 4. Vectorize
      await this.processDocumentsOptimized(validFiles);

    } catch (err: any) {
      console.error(err);
      this.progressStatus.set(`GitHub Error: ${err.message}`);
      alert(`GitHub Import Failed: ${err.message}`);
    } finally {
      this.isIngesting.set(false);
    }
  }

  // --- CORE LOGIC: Optimized Vectorization ---

  private async processDocumentsOptimized(rawFiles: { path: string, content: string }[]) {
    this.progressStatus.set(`Preparing to vectorize ${rawFiles.length} files...`);
    
    const total = rawFiles.length;
    let processed = 0;
    let vectorsGenerated = 0;
    
    // Check config signature
    const currentSignature = this.getCurrentSignature();

    // Store vectors in a temporary buffer before bulk saving
    let pendingVectors: VectorDocument[] = [];

    // Parallel Execution Pool
    await this.runConcurrent(rawFiles, this.CONCURRENCY_LIMIT, async (file) => {
       try {
         const chunks = this.chunkFile(file.path, file.content);
         
         for (let i = 0; i < chunks.length; i++) {
            const chunkData = chunks[i];
            const embedding = await this.llmService.getEmbedding(chunkData.text);
            
            pendingVectors.push({
              id: `${file.path}-${i}`,
              filePath: file.path,
              content: chunkData.text,
              embedding: embedding,
              metadata: { start: chunkData.startIndex, end: chunkData.endIndex }
            });
         }

         vectorsGenerated += chunks.length;
       } catch (e) {
         console.error(`Failed to vectorize ${file.path}`, e);
       } finally {
         processed++;
         this.progressStatus.set(`Vectorizing... ${processed}/${total} files (${vectorsGenerated} vectors)`);
       }
    });

    if (pendingVectors.length > 0) {
      this.progressStatus.set(`Saving ${pendingVectors.length} vectors to database...`);
      await this.vectorStore.addDocuments(pendingVectors, currentSignature);
      this.progressStatus.set(`Done! Indexed ${total} files.`);
    } else {
      this.progressStatus.set('Finished, but no vectors were generated.');
    }
  }

  // --- HELPERS ---

  private async runConcurrent<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
    const executing = new Set<Promise<void>>();
    for (const item of items) {
      const p = fn(item).then(() => { executing.delete(p); });
      executing.add(p);
      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  }

  private chunkFile(path: string, content: string) {
    // Determine chunking strategy based on file type
    const isData = path.endsWith('.json') || path.endsWith('.yaml') || path.endsWith('.csv') || path.endsWith('.xml');
    const isMarkdown = path.endsWith('.md') || path.endsWith('.txt');
    
    // Data/Docs get larger chunks. Code gets smaller, tighter chunks.
    const size = (isData || isMarkdown) ? 800 : 500;
    const overlap = (isData || isMarkdown) ? 100 : 50;

    return chunkTextDetailed(content, size, overlap);
  }

  /**
   * Permissive Filter:
   * 1. Block known binaries/media.
   * 2. Block known system folders.
   * 3. Allow everything else.
   */
  private isAllowed(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    const parts = lower.split('/');
    const fileName = parts[parts.length - 1];

    // 1. Exact Filename Block
    if (this.blockedFileNames.has(fileName)) return false;

    // 2. Directory Block
    for (const part of parts) {
      if (this.blockedDirNames.has(part)) return false;
    }

    // 3. Extension Block (Binary)
    // We check if the file HAS an extension. If no extension (like 'Dockerfile' or 'Makefile'), we allow it.
    if (fileName.includes('.')) {
      const lastDot = fileName.lastIndexOf('.');
      const ext = fileName.substring(lastDot); // includes dot
      if (this.binaryExtensions.has(ext)) return false;
    }

    return true;
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  // --- SEARCH ---

  async search(query: string, topK: number = 10, minScore: number = 0.0) {
    const embedding = await this.llmService.getEmbedding(query);
    const results = this.vectorStore.similaritySearch(embedding, topK, minScore);
    
    return results.map(r => ({
      score: r.score,
      source: r.doc.filePath,
      content: r.doc.content,
      metadata: r.doc.metadata
    }));
  }

  // --- GIT UTILS ---

  private parseRepoUrl(url: string) {
    try {
      const clean = url.replace('https://github.com/', '').replace('http://github.com/', '').replace(/\/$/, '');
      const parts = clean.split('/');
      if (parts.length < 2) throw new Error();
      return { owner: parts[0], repo: parts[1] };
    } catch {
      throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
    }
  }

  private async fetchGitTree(owner: string, repo: string, branch: string) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API Error: ${res.status}`);
    return await res.json();
  }

  private async fetchText(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch Error: ${res.status}`);
    return await res.text();
  }

  private getCurrentSignature(): string {
    const c = this.llmService.config();
    // Correctly accessing the openaiEmbedding model property
    const model = c.embeddingProvider === 'gemini' ? c.gemini.embeddingModel : c.openaiEmbedding.model;
    return `${c.embeddingProvider}:${model}`;
  }
}