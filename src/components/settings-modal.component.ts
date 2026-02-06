import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LlmService, LlmConfig, LlmProvider } from '../services/llm.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
         (click)="onBackdropClick()">
      
      <!-- Modal Content -->
      <div class="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto"
           (click)="$event.stopPropagation()">
        
        <!-- Close Button -->
        <button (click)="cancel()" class="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        <h2 class="text-xl font-bold text-white mb-6 font-mono flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          SYSTEM CONFIGURATION
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <!-- LEFT COLUMN: Chat Intelligence -->
          <div class="space-y-4">
            <h3 class="text-sm font-bold text-slate-300 border-b border-slate-700 pb-2">1. Chat Intelligence</h3>
            
            <div>
              <label class="block text-[10px] font-mono uppercase text-slate-500 mb-2">Provider</label>
              <div class="flex bg-slate-950 p-1 rounded-md border border-slate-800">
                <button (click)="config.chatProvider = 'gemini'" [class]="getBtnClass(config.chatProvider === 'gemini', 'green')">
                  GEMINI (CLOUD)
                </button>
                <button (click)="config.chatProvider = 'lm-studio'" [class]="getBtnClass(config.chatProvider === 'lm-studio', 'blue')">
                  LOCAL (LM STUDIO)
                </button>
              </div>
            </div>

            @if (config.chatProvider === 'gemini') {
              <div class="animate-fade-in-down space-y-3">
                <label class="block text-[10px] uppercase font-mono text-slate-500">Gemini Model</label>
                <input [(ngModel)]="config.geminiChatModel" list="gem-chat" class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-green-400 font-mono focus:border-green-500 outline-none">
                <datalist id="gem-chat">
                  <option value="gemini-2.5-flash"></option>
                  <option value="gemini-1.5-flash"></option>
                </datalist>
              </div>
            } @else {
              <div class="animate-fade-in-down space-y-3">
                <label class="block text-[10px] uppercase font-mono text-slate-500">Local Model ID</label>
                <input [(ngModel)]="config.lmStudioChatModel" type="text" class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-blue-400 font-mono focus:border-blue-500 outline-none">
              </div>
            }
          </div>

          <!-- RIGHT COLUMN: Embeddings (Vector Store) -->
          <div class="space-y-4">
            <h3 class="text-sm font-bold text-slate-300 border-b border-slate-700 pb-2">2. Embeddings (RAG)</h3>
            
            <div>
              <label class="block text-[10px] font-mono uppercase text-slate-500 mb-2">Provider</label>
              <div class="flex bg-slate-950 p-1 rounded-md border border-slate-800">
                <button (click)="config.embeddingProvider = 'gemini'" [class]="getBtnClass(config.embeddingProvider === 'gemini', 'green')">
                  GEMINI
                </button>
                <button (click)="config.embeddingProvider = 'lm-studio'" [class]="getBtnClass(config.embeddingProvider === 'lm-studio', 'blue')">
                  LOCAL
                </button>
              </div>
            </div>

            @if (config.embeddingProvider === 'gemini') {
              <div class="animate-fade-in-down space-y-3">
                <label class="block text-[10px] uppercase font-mono text-slate-500">Gemini Model</label>
                <input [(ngModel)]="config.geminiEmbeddingModel" list="gem-embed" class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-green-400 font-mono focus:border-green-500 outline-none">
                <datalist id="gem-embed">
                  <option value="text-embedding-004"></option>
                  <option value="embedding-001"></option>
                </datalist>
              </div>
            } @else {
              <div class="animate-fade-in-down space-y-3">
                <label class="block text-[10px] uppercase font-mono text-slate-500">Local Model ID</label>
                <input [(ngModel)]="config.lmStudioEmbeddingModel" type="text" class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-blue-400 font-mono focus:border-blue-500 outline-none">
                <p class="text-[9px] text-slate-500">Suggested: text-embedding-nomic-embed-text-v1.5</p>
              </div>
            }
          </div>

        </div>

        <!-- GLOBAL LOCAL SETTINGS -->
        @if (config.chatProvider === 'lm-studio' || config.embeddingProvider === 'lm-studio') {
           <div class="mt-6 pt-4 border-t border-slate-800 animate-fade-in-down">
             <h3 class="text-xs font-bold text-slate-400 font-mono mb-3">LOCAL SERVER CONFIGURATION (Common)</h3>
             
             <div class="flex gap-2">
                <div class="flex-1">
                  <label class="block text-[10px] uppercase font-mono text-slate-500 mb-1">API Base URL</label>
                  <input 
                    [(ngModel)]="config.lmStudioUrl" 
                    type="text" 
                    placeholder="http://localhost:1234/v1"
                    class="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:border-blue-500 outline-none"
                  >
                </div>
                <div class="flex items-end">
                  <button (click)="testConnection()" [disabled]="testingConnection()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded border border-slate-700 transition-colors">
                    {{ testingConnection() ? 'Checking...' : 'Test Connection' }}
                  </button>
                </div>
             </div>

             <!-- Connection Feedback -->
             @if (connectionStatus()) {
               <div [class]="'mt-2 p-2 rounded text-[10px] font-mono border ' + 
                 (connectionStatus()?.success ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400')">
                 {{ connectionStatus()?.message }}
                 @if (!connectionStatus()?.success && isHttps()) {
                    <div class="mt-1 text-orange-400 font-bold">
                       Warning: You are on HTTPS. Browsers often block HTTP (localhost) requests.
                       Try disabling "Shields" or "Safe Browsing" for this tab, or use a tunneling service (ngrok).
                    </div>
                 }
               </div>
             }
           </div>
        }

        <!-- General Settings -->
        <div class="mt-6 pt-4 border-t border-slate-800">
           <div class="flex justify-between items-center mb-1">
               <label class="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Similarity Threshold (Strictness)</label>
               <span class="text-xs font-mono text-blue-400 font-bold">{{ (config.minRelevanceScore * 100) | number:'1.0-0' }}%</span>
           </div>
           <!-- Use (input) to force numeric conversion -->
           <input 
             type="range" 
             min="0" 
             max="0.95" 
             step="0.05" 
             [value]="config.minRelevanceScore" 
             (input)="updateScore($event)"
             class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
           >
           <div class="flex justify-between mt-1 text-[9px] text-slate-600 font-mono">
              <span>0% (All Chunks)</span>
              <span>Default (~45%)</span>
              <span>95% (Exact Matches)</span>
           </div>
        </div>

        <div class="mt-8 flex justify-end gap-3">
          <button (click)="cancel()" class="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white transition-colors">CANCEL</button>
          <button (click)="save()" class="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 text-white font-bold rounded shadow-lg text-xs font-mono">
            SAVE CONFIGURATION
          </button>
        </div>
      </div>
    </div>
  `
})
export class SettingsModalComponent {
  private llmService = inject(LlmService);
  close = output<void>();
  
  config: LlmConfig = { ...this.llmService.config() };
  
  // Connection Testing State
  testingConnection = signal(false);
  connectionStatus = signal<{success: boolean, message: string} | null>(null);

  getBtnClass(active: boolean, color: 'green' | 'blue') {
    const base = 'flex-1 py-2 px-3 rounded text-xs font-mono transition-all duration-200 ';
    if (!active) return base + 'text-slate-500 hover:text-slate-300';
    return base + (color === 'green' 
      ? 'bg-slate-800 text-green-400 shadow-sm border border-slate-700' 
      : 'bg-slate-800 text-blue-400 shadow-sm border border-slate-700');
  }

  updateScore(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.config.minRelevanceScore = parseFloat(val);
  }

  isHttps() {
    return window.location.protocol === 'https:';
  }

  async testConnection() {
    this.testingConnection.set(true);
    this.connectionStatus.set(null);
    try {
      // Attempt to list models from LM Studio / OpenAI compatible endpoint
      // Usually GET /v1/models
      const baseUrl = this.config.lmStudioUrl.replace(/\/chat\/completions$/, '').replace(/\/$/, '');
      const testUrl = `${baseUrl}/models`;
      
      const res = await fetch(testUrl, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        this.connectionStatus.set({ success: true, message: 'SUCCESS: Connected to Local Server.' });
      } else {
        this.connectionStatus.set({ success: false, message: `Connected but server returned ${res.status}.` });
      }
    } catch (e: any) {
      let msg = e.message;
      if (msg.includes('Failed to fetch')) {
        msg = 'Connection Failed. Browser blocked the request or Server is down.';
      }
      this.connectionStatus.set({ success: false, message: msg });
    } finally {
      this.testingConnection.set(false);
    }
  }

  onBackdropClick() { this.cancel(); }
  save() { this.llmService.updateConfig(this.config); this.close.emit(); }
  cancel() { this.close.emit(); }
}