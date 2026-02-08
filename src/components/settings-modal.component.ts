import { Component, inject, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LlmService, LlmConfig, LlmProvider } from '../services/llm.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" (click)="onBackdropClick()">
      <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-950 rounded-t-xl">
          <h2 class="text-lg font-mono font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            LLM CONFIGURATION
          </h2>
          <button (click)="cancel()" class="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          
          <!-- PRESETS ROW -->
          <div class="space-y-2">
            <label class="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-wider">Quick Presets</label>
            <div class="flex flex-wrap gap-2">
               <button (click)="applyPreset('gemini')" 
                 [class]="getPresetClass('gemini')"
                 class="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-all">
                 <div class="w-2 h-2 rounded-full bg-green-500"></div> Google Gemini
               </button>

               <button (click)="applyPreset('openai')" 
                 [class]="getPresetClass('openai')"
                 class="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-all">
                 <div class="w-2 h-2 rounded-full bg-blue-500"></div> OpenAI
               </button>
               
               <button (click)="applyPreset('groq')" 
                 [class]="getPresetClass('openai')" 
                 class="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-all">
                 <div class="w-2 h-2 rounded-full bg-orange-500"></div> Groq
               </button>

               <button (click)="applyPreset('lmstudio')" 
                 [class]="getPresetClass('openai')" 
                 class="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-all">
                 <div class="w-2 h-2 rounded-full bg-purple-500"></div> LM Studio (Local)
               </button>

               <button (click)="applyPreset('ollama')" 
                 [class]="getPresetClass('openai')" 
                 class="flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-all">
                 <div class="w-2 h-2 rounded-full bg-white"></div> Ollama
               </button>
            </div>
          </div>

          <hr class="border-slate-800">

          <!-- CONFIG FORM -->
          <div class="space-y-4 animate-fade-in bg-slate-800/30 p-4 rounded-lg border border-slate-800">
            
            <!-- Connection Info -->
            <div class="flex justify-between items-center mb-2">
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                Connection Details
                <span class="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono uppercase">
                  {{ config.chatProvider === 'gemini' ? 'Google SDK' : 'OpenAI Compatible' }}
                </span>
              </h3>
            </div>

            <div class="grid grid-cols-1 gap-4">
               <!-- Base URL (Hidden for Gemini) -->
               @if (config.chatProvider !== 'gemini') {
                 <div class="space-y-1">
                    <label class="text-[10px] text-slate-500 font-mono uppercase">Base URL</label>
                    <input type="text" [(ngModel)]="proxyBaseUrl" 
                      placeholder="https://api.openai.com/v1"
                      class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-blue-300 font-mono focus:border-blue-500 outline-none transition-colors">
                 </div>
               }

               <!-- API Key -->
               <div class="space-y-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase">API Key {{ config.chatProvider !== 'gemini' && config.openai.baseUrl.includes('localhost') ? '(Optional)' : '' }}</label>
                  <input type="password" [(ngModel)]="proxyApiKey" 
                    [placeholder]="config.chatProvider === 'gemini' ? 'Enter Gemini API Key' : 'sk-...'"
                    class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-purple-500 outline-none transition-colors">
               </div>
            </div>

            <!-- Models -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
               
               <!-- CHAT MODEL -->
               <div class="space-y-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase">Chat Model ID</label>
                  
                  <div class="flex gap-2">
                    <!-- 1. Gemini: Fixed List -->
                    @if (config.chatProvider === 'gemini') {
                       <select [(ngModel)]="proxyChatModel" 
                               class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-purple-500 outline-none transition-colors cursor-pointer appearance-none">
                          <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                       </select>
                    }
                    <!-- 2. OpenAI: Fetched List -->
                    @else if (hasFetchedModels()) {
                       <select [(ngModel)]="proxyChatModel" 
                               class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-purple-500 outline-none transition-colors cursor-pointer appearance-none">
                          @for (model of fetchedModels(); track model) {
                             <option [value]="model">{{ model }}</option>
                          }
                       </select>
                    } 
                    <!-- 3. OpenAI: Manual Input (Default) -->
                    @else {
                      <input type="text" [(ngModel)]="proxyChatModel" 
                        class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-purple-500 outline-none transition-colors"
                        placeholder="e.g. gpt-4o">
                    }

                     <!-- Fetch Button -->
                     @if (config.chatProvider !== 'gemini') {
                       <button (click)="fetchModels()" [disabled]="fetchingModels()" 
                         class="px-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors flex items-center justify-center"
                         title="Fetch Models">
                         <span [class.animate-spin]="fetchingModels()">⟳</span>
                       </button>
                     }
                  </div>
               </div>

               <!-- EMBEDDING MODEL -->
               <div class="space-y-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase">Embedding Model ID</label>
                  
                  <!-- 1. Gemini -->
                   @if (config.chatProvider === 'gemini') {
                      <select [(ngModel)]="proxyEmbeddingModel" 
                              class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-purple-500 outline-none transition-colors cursor-pointer appearance-none">
                         <option value="text-embedding-004">text-embedding-004</option>
                      </select>
                   }
                   <!-- 2. OpenAI Fetched -->
                   @else if (hasFetchedModels()) {
                      <select [(ngModel)]="proxyEmbeddingModel" 
                              class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-purple-500 outline-none transition-colors cursor-pointer appearance-none">
                         @for (model of fetchedModels(); track model) {
                            <option [value]="model">{{ model }}</option>
                         }
                      </select>
                   } 
                   <!-- 3. OpenAI Manual -->
                   @else {
                      <input type="text" [(ngModel)]="proxyEmbeddingModel" 
                        class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-purple-500 outline-none transition-colors"
                        placeholder="e.g. text-embedding-3-small">
                   }
               </div>
            </div>
            
            <!-- Connection Status Message -->
            @if (connectionMsg()) {
               <div class="text-[10px] font-mono px-3 py-2 rounded border" 
                 [class.bg-green-900_20]="connectionSuccess()" [class.border-green-800]="connectionSuccess()" [class.text-green-400]="connectionSuccess()"
                 [class.bg-red-900_20]="!connectionSuccess()" [class.border-red-800]="!connectionSuccess()" [class.text-red-400]="!connectionSuccess()">
                  {{ connectionMsg() }}
               </div>
            }

          </div>
        </div>

        <!-- Footer -->
        <div class="p-5 border-t border-slate-700 bg-slate-950 rounded-b-xl flex justify-end gap-3">
           <button (click)="cancel()" class="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white transition-colors">CANCEL</button>
           <button (click)="save()" class="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded shadow-lg text-xs font-mono transition-colors">
             SAVE & CONNECT
           </button>
        </div>

      </div>
    </div>
  `
})
export class SettingsModalComponent {
  private llmService = inject(LlmService);
  close = output<void>();

  // Deep clone config
  config: LlmConfig = JSON.parse(JSON.stringify(this.llmService.config()));
  
  // UI State
  fetchingModels = signal(false);
  connectionMsg = signal('');
  connectionSuccess = signal(false);
  
  // Signal to store models
  fetchedModels = signal<string[]>([]);
  
  // Computed to easily check if we should show dropdown
  hasFetchedModels = computed(() => this.fetchedModels().length > 0);

  // --- PROXY GETTERS/SETTERS ---

  get proxyApiKey(): string {
    return this.config.chatProvider === 'gemini' ? this.config.gemini.apiKey : this.config.openai.apiKey;
  }
  set proxyApiKey(val: string) {
    if (this.config.chatProvider === 'gemini') this.config.gemini.apiKey = val;
    else this.config.openai.apiKey = val;
  }

  get proxyBaseUrl(): string {
    return this.config.openai.baseUrl;
  }
  set proxyBaseUrl(val: string) {
    this.config.openai.baseUrl = val;
  }

  get proxyChatModel(): string {
    return this.config.chatProvider === 'gemini' ? this.config.gemini.chatModel : this.config.openai.chatModel;
  }
  set proxyChatModel(val: string) {
    if (this.config.chatProvider === 'gemini') this.config.gemini.chatModel = val;
    else this.config.openai.chatModel = val;
  }

  get proxyEmbeddingModel(): string {
    return this.config.embeddingProvider === 'gemini' ? this.config.gemini.embeddingModel : this.config.openai.embeddingModel;
  }
  set proxyEmbeddingModel(val: string) {
    if (this.config.chatProvider === 'gemini') {
       this.config.gemini.embeddingModel = val;
    } else {
       this.config.openai.embeddingModel = val;
    }
  }

  // --- ACTIONS ---

  getPresetClass(type: string) {
    const isGemini = this.config.chatProvider === 'gemini';
    const isTypeGemini = type === 'gemini';
    
    // Simple logic: if provider matches, highlight
    if (isGemini && isTypeGemini) return 'bg-slate-700 border-slate-500 text-white shadow-md';
    if (!isGemini && !isTypeGemini) return 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white';
    
    return 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800';
  }

  applyPreset(type: 'gemini' | 'openai' | 'groq' | 'lmstudio' | 'ollama') {
    this.connectionMsg.set(''); 
    this.fetchedModels.set([]); // Reset models on preset change to force re-fetch or manual entry

    if (type === 'gemini') {
      this.config.chatProvider = 'gemini';
      this.config.embeddingProvider = 'gemini';
      if (!this.config.gemini.chatModel) this.config.gemini.chatModel = 'gemini-2.5-flash';
      if (!this.config.gemini.embeddingModel) this.config.gemini.embeddingModel = 'text-embedding-004';
    } else {
      this.config.chatProvider = 'openai';
      this.config.embeddingProvider = 'openai';
      
      switch(type) {
        case 'openai':
          this.config.openai.baseUrl = 'https://api.openai.com/v1';
          this.config.openai.chatModel = 'gpt-4o';
          this.config.openai.embeddingModel = 'text-embedding-3-small';
          break;
        case 'groq':
          this.config.openai.baseUrl = 'https://api.groq.com/openai/v1';
          this.config.openai.chatModel = 'llama3-70b-8192';
          this.config.openai.embeddingModel = ''; 
          break;
        case 'lmstudio':
          this.config.openai.baseUrl = 'http://localhost:1234/v1';
          this.config.openai.chatModel = 'local-model';
          this.config.openai.embeddingModel = 'text-embedding-nomic-embed-text-v1.5';
          break;
        case 'ollama':
          this.config.openai.baseUrl = 'http://localhost:11434/v1';
          this.config.openai.chatModel = 'llama3';
          this.config.openai.embeddingModel = 'nomic-embed-text';
          break;
      }
    }
  }

  async fetchModels() {
    if (this.config.chatProvider === 'gemini') return; 

    this.fetchingModels.set(true);
    this.connectionMsg.set('Connecting to ' + this.config.openai.baseUrl + '...');
    this.connectionSuccess.set(false);
    this.fetchedModels.set([]);

    const { baseUrl, apiKey } = this.config.openai;
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    try {
      const headers: any = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(`${cleanUrl}/models`, { 
        method: 'GET', 
        headers,
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const responseBody = await res.json();
      
      // Handle standard OpenAI format { data: [...] } or just array [...]
      const list = Array.isArray(responseBody) ? responseBody : (responseBody.data || []);
      
      if (list.length > 0) {
        // Extract IDs securely
        const ids = list
          .map((item: any) => item.id)
          .filter((id: any) => typeof id === 'string')
          .sort();
          
        this.fetchedModels.set(ids);
        
        // Auto-fix current selection if it's not in list, or keep it if it is
        if (!ids.includes(this.proxyChatModel)) {
            // Optional: You might want to default to the first one, or just let user pick
            // this.proxyChatModel = ids[0];
        }

        this.connectionSuccess.set(true);
        this.connectionMsg.set(`Success: Found ${ids.length} models.`);
      } else {
        this.connectionSuccess.set(true);
        this.connectionMsg.set('Connected, but no models returned.');
      }

    } catch (e: any) {
      this.connectionSuccess.set(false);
      this.connectionMsg.set(`Error: ${e.message}`);
    } finally {
      this.fetchingModels.set(false);
    }
  }

  onBackdropClick() { this.close.emit(); }
  cancel() { this.close.emit(); }
  
  save() { 
    this.llmService.updateConfig(this.config);
    this.close.emit();
  }
}