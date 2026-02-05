import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LlmService, LlmConfig } from '../services/llm.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop: clicking here closes the modal -->
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
         (click)="onBackdropClick()">
      
      <!-- Modal Content: stopPropagation ensures clicks here don't hit the backdrop handler -->
      <div class="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto"
           (click)="$event.stopPropagation()">
        
        <!-- Close 'X' Button -->
        <button (click)="cancel()" class="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        <h2 class="text-xl font-bold text-white mb-4 font-mono flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          SYSTEM CONFIG
        </h2>
        
        <div class="space-y-6">
          
          <!-- Provider Selection -->
          <div>
            <label class="block text-[10px] font-mono uppercase text-slate-400 mb-2 tracking-wider">Inference Engine</label>
            <div class="flex bg-slate-950 p-1 rounded-md border border-slate-800">
              <button 
                (click)="setProvider('gemini')"
                [class]="'flex-1 py-2 px-3 rounded text-xs font-mono transition-all duration-200 ' + 
                (config.provider === 'gemini' ? 'bg-slate-800 text-green-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300')">
                GOOGLE GEMINI
              </button>
              <button 
                (click)="setProvider('lm-studio')"
                [class]="'flex-1 py-2 px-3 rounded text-xs font-mono transition-all duration-200 ' + 
                (config.provider === 'lm-studio' ? 'bg-slate-800 text-blue-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300')">
                LM STUDIO (LOCAL)
              </button>
            </div>
          </div>

          <!-- RAG Accuracy Setting -->
          <div>
             <div class="flex justify-between items-center mb-1">
               <label class="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Retrieval Strictness</label>
               <span class="text-xs font-mono text-blue-400 font-bold">{{ (config.minRelevanceScore * 100) | number:'1.0-0' }}%</span>
             </div>
             
             <input 
               type="range" 
               min="0" 
               max="0.95" 
               step="0.05" 
               [(ngModel)]="config.minRelevanceScore"
               class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
             >
             
             <div class="flex justify-between text-[9px] font-mono text-slate-600 mt-1">
               <span>Loose (More Noise)</span>
               <span>Strict (Less Context)</span>
             </div>
          </div>

          @if (config.provider === 'lm-studio') {
            <div class="space-y-3 animate-fade-in-down border-t border-slate-800 pt-4">
              <div>
                <label class="block text-[10px] uppercase font-mono text-slate-500 mb-1">API Base URL</label>
                <input 
                  [(ngModel)]="config.lmStudioUrl" 
                  type="text" 
                  placeholder="http://localhost:1234/v1"
                  class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none transition-colors"
                >
              </div>
              
              <!-- Chat Model -->
              <div>
                <label class="block text-[10px] uppercase font-mono text-slate-500 mb-1">Chat Model ID (LLM)</label>
                <input 
                  [(ngModel)]="config.lmStudioChatModel" 
                  type="text" 
                  placeholder="e.g. llama-3-instruct"
                  class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none transition-colors"
                >
              </div>

              <!-- Embedding Model -->
              <div>
                <label class="block text-[10px] uppercase font-mono text-yellow-500/80 mb-1">Embedding Model ID</label>
                <input 
                  [(ngModel)]="config.lmStudioEmbeddingModel" 
                  type="text" 
                  placeholder="e.g. text-embedding-nomic-embed-text-v1.5"
                  class="w-full bg-slate-950 border border-yellow-800/50 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:border-yellow-500 outline-none transition-colors"
                >
                <p class="text-[9px] text-slate-500 mt-1">
                   Required for ingesting files. This must match the Embedding model loaded in LM Studio.
                </p>
              </div>

              <div class="bg-blue-900/20 border border-blue-900/30 p-3 rounded flex gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                   <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                 </svg>
                 <div class="text-[10px] text-blue-300/80 leading-relaxed">
                   <p class="mb-1"><strong>Usage Tip:</strong></p>
                   1. Load an <strong>Embedding Model</strong> (e.g. Nomic) in LM Studio.<br>
                   2. Ingest your files in this app.<br>
                   3. Load a <strong>Chat Model</strong> (e.g. Mistral) in LM Studio.<br>
                   4. Chat with your codebase.
                 </div>
              </div>
            </div>
          } @else {
            <div class="p-4 bg-slate-950/50 rounded border border-slate-800/50 animate-fade-in-down border-t border-slate-800 mt-4">
               <div class="flex items-center gap-2 mb-2">
                 <div class="w-2 h-2 rounded-full bg-green-500"></div>
                 <span class="text-xs font-bold text-slate-200">Cloud Inference Active</span>
               </div>
               <p class="text-[11px] text-slate-500">Using environment API Key. Optimized for flash models.</p>
            </div>
          }

        </div>

        <div class="mt-8 flex justify-end gap-3">
          <button 
            (click)="cancel()"
            class="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white transition-colors">
            CANCEL
          </button>
          <button 
            (click)="save()"
            class="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded shadow-lg shadow-blue-900/20 text-xs font-mono transition-all transform active:scale-95">
            SAVE CONFIGURATION
          </button>
        </div>
      </div>
    </div>
  `
})
export class SettingsModalComponent {
  private llmService = inject(LlmService);
  
  // Define Output signal
  close = output<void>();
  
  config: LlmConfig = { ...this.llmService.config() };

  setProvider(p: 'gemini' | 'lm-studio') {
    this.config.provider = p;
  }

  onBackdropClick() {
    this.cancel();
  }

  save() {
    this.llmService.updateConfig(this.config);
    this.close.emit();
  }

  cancel() {
    this.close.emit();
  }
}