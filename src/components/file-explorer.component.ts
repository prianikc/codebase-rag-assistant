import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KnowledgeBaseService } from '../services/knowledge-base.service';
import { VectorStoreService } from '../services/vector-store.service';
import { ChatHistoryService } from '../services/chat-history.service';

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col h-full bg-slate-900 border-r border-slate-700 text-slate-300 w-full select-none">
      
      <!-- Top Bar: Tabs -->
      <div class="flex border-b border-slate-700 bg-slate-950">
        <button 
          (click)="activeTab.set('files')"
          [class]="getTabClass('files')"
        >
          FILES
        </button>
        <button 
          (click)="activeTab.set('chats')"
          [class]="getTabClass('chats')"
        >
          CHATS
        </button>
      </div>

      <!-- CONTENT: FILES TAB -->
      @if (activeTab() === 'files') {
        <!-- Info Header -->
        <div class="p-4 border-b border-slate-700 bg-slate-900/50 flex justify-between items-start shrink-0">
          <div>
            <div class="flex flex-col">
               <p class="text-[10px] text-slate-500 font-mono">
                 Files: {{ kbService.totalFiles() }}
               </p>
               <div class="flex items-center gap-2">
                 <p class="text-[10px] text-green-500 font-mono">
                   Vectors: {{ vectorStore.docCount() }}
                 </p>
                 <!-- Clear Vectors Button -->
                 @if (vectorStore.docCount() > 0) {
                   <button 
                     (click)="clearVectors()"
                     title="Clear Vector Database"
                     class="text-slate-600 hover:text-red-500 transition-colors"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                       <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                     </svg>
                   </button>
                 }
               </div>
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
            <!-- Open Local Dir -->
            <label class="
              flex-1 flex flex-col items-center justify-center py-2 px-1
              bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded 
              cursor-pointer transition-all text-[10px] font-mono uppercase font-bold tracking-wider text-center
              group
            ">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mb-1 text-yellow-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

            <!-- Toggle GitHub Input -->
            <button 
              (click)="toggleRepoInput()"
              class="
              flex-1 flex flex-col items-center justify-center py-2 px-1
              bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded 
              cursor-pointer transition-all text-[10px] font-mono uppercase font-bold tracking-wider text-center
              group
              "
              [class.bg-slate-700]="showRepoInput"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mb-1 text-purple-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              GitHub
            </button>
          </div>

          <!-- GitHub Input Area -->
          @if (showRepoInput) {
            <div class="mt-2 animate-fade-in-down">
               <div class="flex gap-1">
                 <input 
                   type="text" 
                   [(ngModel)]="repoUrl"
                   placeholder="owner/repo"
                   (keydown.enter)="loadRepo()"
                   class="w-full bg-slate-950 border border-slate-600 rounded px-2 py-1 text-[10px] font-mono text-white focus:border-purple-500 outline-none"
                 >
                 <button 
                   (click)="loadRepo()"
                   [disabled]="kbService.isIngesting() || !repoUrl.trim()"
                   class="bg-purple-600 hover:bg-purple-500 text-white px-2 rounded disabled:opacity-50"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                     <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                   </svg>
                 </button>
               </div>
               <p class="text-[8px] text-slate-500 mt-1 font-mono">e.g. angular/angular</p>
            </div>
          }

          @if (kbService.progressStatus()) {
            <div class="text-[9px] text-orange-300 font-mono text-center animate-pulse mt-2">
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
      } 
      <!-- CONTENT: CHATS TAB -->
      @else {
        <div class="flex flex-col h-full">
           <div class="p-4">
             <button 
               (click)="chatService.createNewSession()"
               class="w-full flex items-center justify-center gap-2 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-mono font-bold shadow-lg transition-all"
             >
               <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
               </svg>
               NEW CHAT
             </button>
           </div>

           <div class="flex-1 overflow-y-auto p-2 space-y-1">
             @for (session of chatService.sessions(); track session.id) {
               <div 
                 (click)="chatService.selectSession(session.id)"
                 class="group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all duration-200"
                 [class.bg-slate-800]="chatService.currentSessionId() === session.id"
                 [class.border-blue-500]="chatService.currentSessionId() === session.id"
                 [class.border-transparent]="chatService.currentSessionId() !== session.id"
                 [class.hover:bg-slate-800]="chatService.currentSessionId() !== session.id"
               >
                 <div class="overflow-hidden">
                   <h3 class="text-xs font-mono font-bold text-slate-200 truncate">
                     {{ session.title }}
                   </h3>
                   <p class="text-[10px] text-slate-500 font-mono mt-0.5">
                     {{ session.messages.length }} msgs • {{ session.lastUpdate | date:'shortDate' }}
                   </p>
                 </div>
                 
                 <button 
                   (click)="$event.stopPropagation(); deleteSession(session.id)"
                   class="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded transition-all"
                   title="Delete Chat"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                     <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                   </svg>
                 </button>
               </div>
             }
           </div>
        </div>
      }

    </div>
  `
})
export class FileExplorerComponent {
  public kbService = inject(KnowledgeBaseService);
  public vectorStore = inject(VectorStoreService);
  public chatService = inject(ChatHistoryService);

  // Tabs
  activeTab = signal<'files' | 'chats'>('files');

  // GitHub Repo Input State
  showRepoInput = false;
  repoUrl = '';

  // Tree Logic
  treeNodes = computed(() => {
    const paths = this.kbService.filePaths();
    return this.buildTree(paths);
  });
  
  openFolders = signal<Set<string>>(new Set());

  getTabClass(tab: 'files' | 'chats') {
    const base = 'flex-1 py-3 text-[10px] font-mono font-bold tracking-widest transition-colors ';
    if (this.activeTab() === tab) {
      return base + 'bg-slate-900 text-blue-400 border-b-2 border-blue-500';
    }
    return base + 'bg-slate-950 text-slate-500 hover:text-slate-300 hover:bg-slate-900';
  }

  toggleRepoInput() {
    this.showRepoInput = !this.showRepoInput;
  }

  loadRepo() {
    if (!this.repoUrl.trim()) return;
    this.kbService.ingestGitHubRepo(this.repoUrl.trim());
  }

  onFolderSelected(event: Event, input: HTMLInputElement) {
    if (input.files && input.files.length > 0) {
      this.kbService.ingestFiles(input.files);
      input.value = '';
    }
  }

  clearVectors() {
    if (confirm('Are you sure you want to clear the Vector Database? This will remove all indexed code context.')) {
      this.vectorStore.clear();
      // Clean up file list too since they are no longer indexed
      this.kbService.totalFiles.set(0);
      this.kbService.filePaths.set([]);
    }
  }

  deleteSession(id: string) {
    if (confirm('Delete this chat history?')) {
      this.chatService.deleteSession(id);
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
