import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KnowledgeBaseService } from '../services/knowledge-base.service';
import { VectorStoreService } from '../services/vector-store.service';

interface FileNode {
  name: string;
  path: string; // Full relative path
  type: 'file' | 'folder';
  children: FileNode[];
  isOpen: boolean; // For folders
  level: number;
}

@Component({
  selector: 'app-file-explorer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full bg-slate-900 border-r border-slate-700 text-slate-300 w-full">
      <!-- Header -->
      <div class="p-4 border-b border-slate-700 bg-slate-950 flex justify-between items-start shrink-0">
        <div>
          <h1 class="font-mono text-sm font-bold text-slate-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            PROJECT_TREE
          </h1>
          <div class="flex flex-col mt-1">
             <p class="text-[10px] text-slate-500 font-mono">
               Files: {{ kbService.totalFiles() }}
             </p>
             <p class="text-[10px] text-green-500 font-mono">
               Vectors: {{ vectorStore.docCount() }}
             </p>
          </div>
        </div>
        
        <!-- Tree Controls -->
        <div class="flex gap-1">
          <button (click)="expandAll()" title="Expand All" class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button (click)="collapseAll()" title="Collapse All" class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Import Controls -->
      <div class="p-4 gap-2 flex flex-col border-b border-slate-800 shrink-0">
        <div class="flex gap-2">
          <label class="
            flex-1 flex flex-col items-center justify-center py-2 px-1
            bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded 
            cursor-pointer transition-all text-[10px] font-mono uppercase font-bold tracking-wider text-center
          ">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mb-1 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Open Dir
            <input 
              #folderInput
              type="file" 
              webkitdirectory 
              directory 
              multiple 
              class="hidden" 
              (change)="onFolderSelected($event, folderInput)"
            >
          </label>
        </div>

        @if (kbService.progressStatus()) {
          <div class="text-[9px] text-orange-300 font-mono text-center animate-pulse">
            {{ kbService.progressStatus() }}
          </div>
        }
      </div>

      <!-- Tree View Container -->
      <div class="flex-1 overflow-y-auto overflow-x-hidden p-2">
        @if (kbService.isIngesting()) {
          <div class="flex flex-col items-center justify-center h-40 gap-4">
             <div class="relative w-8 h-8">
               <div class="absolute inset-0 border-2 border-slate-700 rounded-full"></div>
               <div class="absolute inset-0 border-t-2 border-green-500 rounded-full animate-spin"></div>
             </div>
            <span class="text-[10px] font-mono text-green-500 text-center px-4">
              PROCESSING...
            </span>
          </div>
        } @else if (treeNodes().length === 0) {
          <div class="p-8 text-center opacity-50 flex flex-col items-center">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mb-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
             </svg>
             <p class="text-[10px] text-slate-500 font-mono">No files loaded.</p>
          </div>
        } @else {
          <!-- Recursive Template -->
          <ng-template #nodeTemplate let-nodes="nodes">
            @for (node of nodes; track node.path) {
              <div class="select-none">
                <!-- Node Row -->
                <div 
                  (click)="toggleNode(node)"
                  class="flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-800 cursor-pointer text-xs font-mono transition-colors truncate"
                  [style.padding-left.px]="node.level * 12 + 8"
                >
                  <!-- Icon -->
                  @if (node.type === 'folder') {
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0 text-yellow-500 transition-transform duration-200" 
                          [class.rotate-90]="node.isOpen" viewBox="0 0 20 20" fill="currentColor">
                       <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                     </svg>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                    </svg>
                  }
                  
                  <span [class.text-slate-400]="node.type === 'folder'" [class.text-slate-200]="node.type === 'file'">
                    {{ node.name }}
                  </span>
                </div>

                <!-- Children -->
                @if (node.type === 'folder' && node.isOpen) {
                  <ng-container *ngTemplateOutlet="nodeTemplate; context: { nodes: node.children }"></ng-container>
                }
              </div>
            }
          </ng-template>

          <ng-container *ngTemplateOutlet="nodeTemplate; context: { nodes: treeNodes() }"></ng-container>
        }
      </div>
    </div>
  `
})
export class FileExplorerComponent {
  public kbService = inject(KnowledgeBaseService);
  public vectorStore = inject(VectorStoreService);

  // We use a signal for treeNodes to be reactive to kbService.filePaths changes
  treeNodes = computed(() => {
    const paths = this.kbService.filePaths();
    return this.buildTree(paths);
  });
  
  // Track open state of folders. Key = path
  openFolders = signal<Set<string>>(new Set());

  onFolderSelected(event: Event, input: HTMLInputElement) {
    if (input.files && input.files.length > 0) {
      this.kbService.ingestFiles(input.files);
      input.value = '';
    }
  }

  toggleNode(node: FileNode) {
    if (node.type === 'folder') {
       const current = new Set(this.openFolders());
       if (current.has(node.path)) {
         current.delete(node.path);
       } else {
         current.add(node.path);
       }
       this.openFolders.set(current);
    }
  }
  
  expandAll() {
    const allPaths = new Set<string>();
    const paths = this.kbService.filePaths();
    paths.forEach(p => {
       const parts = p.split('/');
       let current = '';
       for (let i = 0; i < parts.length - 1; i++) {
         current += (current ? '/' : '') + parts[i];
         allPaths.add(current);
       }
    });
    this.openFolders.set(allPaths);
  }

  collapseAll() {
    this.openFolders.set(new Set());
  }

  private buildTree(paths: string[]): FileNode[] {
    const root: FileNode[] = [];
    const openSet = this.openFolders();

    // Sort paths alphabetically
    const sortedPaths = [...paths].sort();

    for (const path of sortedPaths) {
      const parts = path.split('/');
      let currentLevel = root;
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        currentPath += (currentPath ? '/' : '') + part;

        let node = currentLevel.find(n => n.name === part);

        if (!node) {
          node = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: [],
            isOpen: openSet.has(currentPath),
            level: i
          };
          currentLevel.push(node);
          
          // Sort immediate children: Folders first, then Files
          currentLevel.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
          });
        }

        currentLevel = node.children;
      }
    }
    return root;
  }
}