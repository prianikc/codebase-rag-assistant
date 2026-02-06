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
  public filePaths = signal<string[]>([]);

  private allowedExtensions = [
    '.ts', '.js', '.jsx', '.tsx', '.html', '.css', '.scss', '.json', 
    '.md', '.py', '.java', '.c', '.cpp', '.go', '.rs', '.php', '.sql',
    '.txt', '.env', '.yaml', '.yml', '.xml', '.toml', '.lua', '.sh'
  ];

  private getCurrentSignature(): string {
    const c = this.llmService.config();
    const model = c.embeddingProvider === 'gemini' ? c.geminiEmbeddingModel : c.lmStudioEmbeddingModel;
    return `${c.embeddingProvider}:${model}`;
  }

  async ingestFiles(fileList: FileList) {
    if (this.isIngesting()) return;

    this.isIngesting.set(true);
    this.vectorStore.clear(); // Always start fresh for local app simplicity
    this.totalFiles.set(0);
    this.filePaths.set([]);

    const files = Array.from(fileList);
    
    // 1. Filter and Read Files
    const rawFiles: { path: string, content: string }[] = [];
    
    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      if (this.isAllowed(path)) {
        try {
          const content = await this.readFile(file);
          rawFiles.push({ path, content });
        } catch (e) {
          console.warn('Skipped file', file.name);
        }
      }
    }

    await this.processDocuments(rawFiles);
  }

  async ingestGitHubRepo(repoUrl: string) {
    if (this.isIngesting()) return;
    
    this.isIngesting.set(true);
    this.vectorStore.clear();
    this.totalFiles.set(0);
    this.filePaths.set([]);

    try {
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      this.progressStatus.set(`Connecting to GitHub: ${owner}/${repo}...`);

      // Try main then master
      let branch = 'main';
      let treeData = await this.fetchGitTree(owner, repo, branch);
      if (!treeData) {
        branch = 'master';
        treeData = await this.fetchGitTree(owner, repo, branch);
      }

      if (!treeData) throw new Error('Could not find branch "main" or "master"');

      // Filter blobs
      const filesToFetch = treeData.tree.filter((node: any) => 
        node.type === 'blob' && this.isAllowed(node.path)
      );

      if (filesToFetch.length === 0) throw new Error('No allowed source files found in repository.');

      this.progressStatus.set(`Found ${filesToFetch.length} files. Starting download...`);

      // Parallel Fetching with concurrency limit
      const rawFiles: { path: string, content: string }[] = [];
      const BATCH_SIZE = 5;

      for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
        const batch = filesToFetch.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (node: any) => {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${node.path}`;
          try {
            const content = await this.fetchText(rawUrl);
            return { path: node.path, content };
          } catch (e) {
            console.warn(`Failed to fetch ${node.path}`, e);
            return null;
          }
        });

        const results = await Promise.all(promises);
        results.forEach(r => { if(r) rawFiles.push(r); });
        
        this.progressStatus.set(`Downloading: ${rawFiles.length} / ${filesToFetch.length} files...`);
      }

      await this.processDocuments(rawFiles);

    } catch (err: any) {
      console.error(err);
      alert(`GitHub Ingestion Failed:\n${err.message}`);
      this.progressStatus.set('Ingestion Failed.');
      this.isIngesting.set(false);
    }
  }

  // Shared Processing Logic
  private async processDocuments(rawFiles: { path: string, content: string }[]) {
    this.totalFiles.set(rawFiles.length);
    this.filePaths.set(rawFiles.map(f => f.path));
    
    this.progressStatus.set(`Ready to vectorize ${rawFiles.length} files...`);

    let processed = 0;
    const vectorDocs: VectorDocument[] = [];
    
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    let aborted = false;

    // Capture the signature at the START of processing
    const currentSignature = this.getCurrentSignature();

    for (const raw of rawFiles) {
      if (aborted) break;

      this.progressStatus.set(`Vectorizing: ${raw.path} (${processed + 1}/${rawFiles.length})`);
      
      const isDataOrText = raw.path.endsWith('.md') || raw.path.endsWith('.txt') || raw.path.endsWith('.json') || raw.path.endsWith('.yaml');
      const chunkSize = isDataOrText ? 600 : 300;
      const overlap = isDataOrText ? 120 : 75;

      const chunks = chunkTextDetailed(raw.content, chunkSize, overlap);
      
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
          
          consecutiveErrors = 0; 
        } catch (err: any) {
           console.error(`Failed to embed chunk of ${raw.path}`, err);
           consecutiveErrors++;
           
           if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
             const reason = err.message || 'Unknown Network Error';
             alert(`Ingestion Aborted!\n\nFailed to connect to LLM Provider multiple times.\nReason: ${reason}\n\nCheck API Keys and Network.`);
             this.progressStatus.set(`Aborted: Connection Failed.`);
             aborted = true;
             break;
           }
        }
      }
      processed++;
    }

    if (!aborted && vectorDocs.length > 0) {
      this.vectorStore.addDocuments(vectorDocs, currentSignature);
      this.progressStatus.set(`Done! Stored ${vectorDocs.length} vector chunks.`);
    } else if (aborted) {
       // Status already set
    } else {
      this.progressStatus.set(`No valid content processed.`);
    }

    this.isIngesting.set(false);
  }

  async search(query: string, topK: number = 10, minScore: number = 0.5): Promise<{ content: string, source: string, score: number }[]> {
    // 1. Check Model Compatibility
    const storeSig = this.vectorStore.getStoreSignature();
    const currentSig = this.getCurrentSignature();

    if (storeSig && storeSig !== currentSig) {
      throw new Error(`Embedding Model Mismatch.\n\nFiles were ingested using: ${storeSig}\nCurrent Configuration is: ${currentSig}\n\nPlease re-ingest your files to match the current provider.`);
    }

    if (this.vectorStore.docCount() === 0) {
      return [];
    }

    // 2. Embed Query
    const queryEmbedding = await this.llmService.getEmbedding(query);
    
    // 3. Search
    const results: SearchResult[] = this.vectorStore.similaritySearch(queryEmbedding, topK, minScore);
    
    return results.map(res => ({
      content: res.doc.content,
      source: res.doc.filePath,
      score: res.score
    }));
  }

  /**
   * Comprehensive Filter based on user-supplied .gitignore patterns
   */
  private isAllowed(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    const fileName = filePath.split('/').pop()?.toLowerCase() || '';

    // 1. BLOCKED DIRECTORIES / SEGMENTS
    const blockedSegments = [
      'node_modules/', '.git/', '.angular/', '.nx/', '.vscode/', '.idea/', 
      'dist/', 'build/', 'out/', 'coverage/', 'tmp/',
      '.next/', '.nuxt/', '.cache/', '.yarn/', '.npm/',
      'bower_components/', 'jspm_packages/', 'web_modules/',
      '.nyc_output/', '.grunt/', '.serverless/', '.fusebox/', '.dynamodb/',
      '.temp/', 'generated/prisma/', 'devops/pg_data/', '.cursor/',
      '.rpt2_cache/', '.rts2_cache/'
    ];

    if (blockedSegments.some(seg => lower.includes(seg))) return false;

    // 2. BLOCKED FILENAMES
    const blockedFiles = [
      '.ds_store', 'thumbs.db', 
      'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.yarn-integrity', 
      '.tern-port', '.node_repl_history', 
      '.eslintcache', '.stylelintcache', 
      'npm-debug.log', 'yarn-debug.log', 'yarn-error.log'
    ];

    if (blockedFiles.includes(fileName)) return false;

    // 3. BLOCKED EXTENSIONS
    const blockedExtensions = [
      '.log', '.pid', '.seed', '.lock', '.tgz', '.gz', '.zip', '.map', 
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', 
      '.exe', '.dll', '.bin', '.class', '.pyc', '.pyo', '.db', '.sqlite', 
      '.suo', '.ntvs', '.njsproj', '.sln', '.tsbuildinfo', '.ttf', '.woff', '.woff2', '.eot'
    ];

    if (blockedExtensions.some(ext => lower.endsWith(ext))) return false;

    // 4. SPECIAL CASE: ENV FILES
    if (fileName.startsWith('.env') && !fileName.includes('example')) return false;

    // 5. WHITELIST CHECK
    const isDocker = lower.endsWith('dockerfile') || lower.endsWith('docker-compose.yml');
    const hasValidExt = this.allowedExtensions.some(ext => lower.endsWith(ext));
    
    return isDocker || hasValidExt;
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  private parseRepoUrl(url: string): { owner: string, repo: string } {
    try {
      const clean = url.replace('https://github.com/', '').replace('http://github.com/', '');
      const parts = clean.split('/');
      if (parts.length < 2) throw new Error('Invalid Repo format');
      return { owner: parts[0], repo: parts[1] };
    } catch (e) {
      throw new Error('Invalid GitHub URL. Format: https://github.com/owner/repo');
    }
  }

  private async fetchGitTree(owner: string, repo: string, branch: string): Promise<any> {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API Error: ${res.status}`);
    return await res.json();
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch Error: ${res.status}`);
    return await res.text();
  }
}
