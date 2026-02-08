import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LlmService, LlmConfig, LlmProvider } from '../services/llm.service';

type PresetType = 'google' | 'openai' | 'ollama' | 'lmstudio' | 'groq';

interface PresetDef {
  label: string;
  provider: LlmProvider;
  url: string;
  defaultModel: string;
}

const PRESETS: Record<PresetType, PresetDef> = {
  google: { 
    label: 'Google Gemini', 
    provider: 'gemini', 
    url: 'https://generativelanguage.googleapis.com/v1beta', 
    defaultModel: 'gemini-2.5-flash' 
  },
  openai: { 
    label: 'OpenAI Cloud', 
    provider: 'openai', 
    url: 'https://api.openai.com/v1', 
    defaultModel: 'gpt-4o' 
  },
  ollama: { 
    label: 'Ollama (Local)', 
    provider: 'openai', 
    url: 'http://localhost:11434/v1', 
    defaultModel: 'llama3' 
  },
  lmstudio: { 
    label: 'LM Studio (Local)', 
    provider: 'openai', 
    url: 'http://localhost:1234/v1', 
    defaultModel: 'local-model' 
  },
  groq: { 
    label: 'Groq Cloud', 
    provider: 'openai', 
    url: 'https://api.groq.com/openai/v1', 
    defaultModel: 'llama3-70b-8192' 
  }
};

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" (click)="onBackdropClick()">
      <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-950 rounded-t-xl">
          <h2 class="text-lg font-mono font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            MODEL CONFIGURATION
          </h2>
          <button (click)="cancel()" class="text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <!-- === LEFT: CHAT MODEL === -->
            <div class="bg-slate-800/20 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
               <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/50">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                   <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                 </svg>
                 <h3 class="text-sm font-bold font-mono uppercase text-blue-400">Chat Model</h3>
               </div>

               <!-- Provider Preset Selector -->
               <div class="flex flex-col gap-1">
                 <label class="text-[10px] text-slate-500 font-mono uppercase font-bold">Provider Preset</label>
                 <select [ngModel]="selectedChatPreset()" (ngModelChange)="applyChatPreset($event)"
                   class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-blue-500 outline-none transition-colors appearance-none cursor-pointer hover:bg-slate-900">
                    <option value="" disabled selected>-- Select Provider --</option>
                    @for (item of presetOptions; track item.key) {
                      <option [value]="item.key">{{ item.def.label }}</option>
                    }
                 </select>
               </div>

               <!-- Base URL -->
               <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase font-bold">Base URL</label>
                  <input type="text" [(ngModel)]="chatBaseUrl" 
                    class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-blue-300 font-mono focus:border-blue-500 outline-none transition-colors" 
                    placeholder="https://api.openai.com/v1">
               </div>

               <!-- API Key -->
               <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase font-bold">API Key</label>
                  <input type="password" [(ngModel)]="chatApiKey" 
                    class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-blue-500 outline-none transition-colors" 
                    placeholder="Enter API Key (Not saved automatically)">
               </div>

               <!-- Model ID -->
               <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase font-bold">Model ID</label>
                  <input type="text" [(ngModel)]="chatModelId" 
                    class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-blue-500 outline-none transition-colors" 
                    placeholder="e.g. gpt-4o">
                  
                  <!-- Detected Models Dropdown -->
                  @if (fetchedChatModels().length > 0) {
                    <select [(ngModel)]="chatModelId" 
                      class="mt-1 w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 font-mono cursor-pointer hover:bg-slate-800 hover:text-white">
                       <option [value]="">Select available model...</option>
                       @for (m of fetchedChatModels(); track m) { <option [value]="m">{{m}}</option> }
                    </select>
                  }
               </div>

               <!-- Check Button & Status -->
               <div class="mt-2">
                 <button (click)="checkChatModels()" [disabled]="isFetchingChat()"
                   class="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-mono text-slate-300 transition-colors flex items-center justify-center gap-2">
                   @if (isFetchingChat()) { <span class="animate-spin">⟳</span> Checking... }
                   @else { <span>?</span> Check Available Models }
                 </button>
                 
                 @if (chatStatus()) {
                   <div class="mt-2 p-2 rounded border text-[10px] font-mono break-all"
                        [class.bg-green-900_20]="!chatError()" [class.border-green-800]="!chatError()" [class.text-green-400]="!chatError()"
                        [class.bg-red-900_20]="chatError()" [class.border-red-800]="chatError()" [class.text-red-400]="chatError()">
                     {{ chatStatus() }}
                   </div>
                 }
               </div>
            </div>

            <!-- === RIGHT: EMBEDDING MODEL === -->
            <div class="bg-slate-800/20 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
               <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700/50">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                   <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                 </svg>
                 <h3 class="text-sm font-bold font-mono uppercase text-green-400">Embedding Model</h3>
               </div>

               <!-- Provider Preset Selector -->
               <div class="flex flex-col gap-1">
                 <label class="text-[10px] text-slate-500 font-mono uppercase font-bold">Provider Preset</label>
                 <select [ngModel]="selectedEmbedPreset()" (ngModelChange)="applyEmbedPreset($event)"
                   class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-green-500 outline-none transition-colors appearance-none cursor-pointer hover:bg-slate-900">
                    <option value="" disabled selected>-- Select Provider --</option>
                    @for (item of presetOptions; track item.key) {
                      <option [value]="item.key">{{ item.def.label }}</option>
                    }
                 </select>
               </div>

               <!-- Base URL -->
               <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase font-bold">Base URL</label>
                  <input type="text" [(ngModel)]="embedBaseUrl" 
                    class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-green-300 font-mono focus:border-green-500 outline-none transition-colors" 
                    placeholder="http://localhost:11434/v1">
               </div>

               <!-- API Key -->
               <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase font-bold">API Key</label>
                  <input type="password" [(ngModel)]="embedApiKey" 
                    class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-green-500 outline-none transition-colors" 
                    placeholder="Enter API Key (Not saved automatically)">
               </div>

               <!-- Model ID -->
               <div class="flex flex-col gap-1">
                  <label class="text-[10px] text-slate-500 font-mono uppercase font-bold">Model ID</label>
                  <input type="text" [(ngModel)]="embedModelId" 
                    class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono focus:border-green-500 outline-none transition-colors" 
                    placeholder="e.g. nomic-embed-text">
                  
                  <!-- Detected Models Dropdown -->
                  @if (fetchedEmbedModels().length > 0) {
                    <select [(ngModel)]="embedModelId" 
                      class="mt-1 w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 font-mono cursor-pointer hover:bg-slate-800 hover:text-white">
                       <option [value]="">Select available model...</option>
                       @for (m of fetchedEmbedModels(); track m) { <option [value]="m">{{m}}</option> }
                    </select>
                  }
               </div>

               <!-- Check Button & Status -->
               <div class="mt-2">
                 <button (click)="checkEmbedModels()" [disabled]="isFetchingEmbed()"
                   class="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-mono text-slate-300 transition-colors flex items-center justify-center gap-2">
                   @if (isFetchingEmbed()) { <span class="animate-spin">⟳</span> Checking... }
                   @else { <span>?</span> Check Available Models }
                 </button>
                 
                 @if (embedStatus()) {
                   <div class="mt-2 p-2 rounded border text-[10px] font-mono break-all"
                        [class.bg-green-900_20]="!embedError()" [class.border-green-800]="!embedError()" [class.text-green-400]="!embedError()"
                        [class.bg-red-900_20]="embedError()" [class.border-red-800]="embedError()" [class.text-red-400]="embedError()">
                     {{ embedStatus() }}
                   </div>
                 }
               </div>
            </div>
            
          </div>
        </div>

        <!-- Footer -->
        <div class="p-5 border-t border-slate-700 bg-slate-950 rounded-b-xl flex justify-end gap-3">
           <button (click)="cancel()" class="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white transition-colors">CANCEL</button>
           <button (click)="save()" class="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded shadow-lg text-xs font-mono transition-colors">
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

  config: LlmConfig = JSON.parse(JSON.stringify(this.llmService.config()));
  
  presetOptions = Object.entries(PRESETS).map(([key, def]) => ({ key: key as PresetType, def }));

  // Selection state for dropdowns
  selectedChatPreset = signal<PresetType | ''>('');
  selectedEmbedPreset = signal<PresetType | ''>('');

  // Async State
  isFetchingChat = signal(false);
  fetchedChatModels = signal<string[]>([]);
  chatStatus = signal('');
  chatError = signal(false);

  isFetchingEmbed = signal(false);
  fetchedEmbedModels = signal<string[]>([]);
  embedStatus = signal('');
  embedError = signal(false);

  constructor() {
    // Initial guess for presets based on provider/url matches
    this.detectPresets();
  }

  detectPresets() {
    // Basic heuristic to show correct dropdown state on open
    if (this.config.chatProvider === 'gemini') {
      this.selectedChatPreset.set('google');
    } else {
      const url = this.config.openaiChat.baseUrl;
      if (url.includes('openai.com')) this.selectedChatPreset.set('openai');
      else if (url.includes('11434')) this.selectedChatPreset.set('ollama');
      else if (url.includes('1234')) this.selectedChatPreset.set('lmstudio');
      else if (url.includes('groq.com')) this.selectedChatPreset.set('groq');
    }

    if (this.config.embeddingProvider === 'gemini') {
      this.selectedEmbedPreset.set('google');
    } else {
      const url = this.config.openaiEmbedding.baseUrl;
      if (url.includes('openai.com')) this.selectedEmbedPreset.set('openai');
      else if (url.includes('11434')) this.selectedEmbedPreset.set('ollama');
    }
  }

  // --- ACTIONS ---

  applyChatPreset(key: PresetType) {
    this.selectedChatPreset.set(key);
    const p = PRESETS[key];
    
    // Set Config
    this.config.chatProvider = p.provider;
    
    // IMPORTANT: Clear Key, Set URL/Model
    if (p.provider === 'gemini') {
      this.config.gemini.apiKey = ''; 
      this.config.gemini.chatModel = p.defaultModel;
      // We also update the 'openai' url field just in case logic switches or for display
      this.config.openaiChat.baseUrl = p.url; 
    } else {
      this.config.openaiChat.apiKey = '';
      this.config.openaiChat.baseUrl = p.url;
      this.config.openaiChat.model = p.defaultModel;
    }

    // Reset fetch state
    this.fetchedChatModels.set([]);
    this.chatStatus.set('');
  }

  applyEmbedPreset(key: PresetType) {
    this.selectedEmbedPreset.set(key);
    const p = PRESETS[key];
    
    this.config.embeddingProvider = p.provider;

    if (p.provider === 'gemini') {
      this.config.gemini.apiKey = ''; 
      this.config.gemini.embeddingModel = p.defaultModel;
      this.config.openaiEmbedding.baseUrl = p.url;
    } else {
      this.config.openaiEmbedding.apiKey = '';
      this.config.openaiEmbedding.baseUrl = p.url;
      this.config.openaiEmbedding.model = p.defaultModel;
    }

    this.fetchedEmbedModels.set([]);
    this.embedStatus.set('');
  }

  // --- ACCESSORS ---
  // These determine which underlying config property is bound to the input
  // Note: For 'gemini', we map the Base URL input to the openaiChat.baseUrl temporarily or a specific var?
  // Actually, to keep it "editable", let's bind it to `openaiChat.baseUrl` but *also* have a getter for gemini?
  // No, LlmService separates them. 
  // Solution: I will create virtual accessors that map to the correct place based on provider.

  get chatBaseUrl(): string { 
    // If provider is gemini, we usually don't use a base url, BUT the user wants to edit it.
    // We will store it in `openaiChat.baseUrl` as a holder, OR we create a new property?
    // Let's stick to using openaiChat.baseUrl as the "generic url holder" even if provider is gemini,
    // just for the UI state.
    return this.config.openaiChat.baseUrl; 
  }
  set chatBaseUrl(v: string) { 
    this.config.openaiChat.baseUrl = v; 
  }

  get chatApiKey(): string { 
    return this.config.chatProvider === 'gemini' ? this.config.gemini.apiKey : this.config.openaiChat.apiKey; 
  }
  set chatApiKey(v: string) {
    if (this.config.chatProvider === 'gemini') this.config.gemini.apiKey = v;
    else this.config.openaiChat.apiKey = v;
  }

  get chatModelId(): string {
    return this.config.chatProvider === 'gemini' ? this.config.gemini.chatModel : this.config.openaiChat.model;
  }
  set chatModelId(v: string) {
    if (this.config.chatProvider === 'gemini') this.config.gemini.chatModel = v;
    else this.config.openaiChat.model = v;
  }

  // Embedding Accessors
  get embedBaseUrl(): string { return this.config.openaiEmbedding.baseUrl; }
  set embedBaseUrl(v: string) { this.config.openaiEmbedding.baseUrl = v; }

  get embedApiKey(): string { 
    return this.config.embeddingProvider === 'gemini' ? this.config.gemini.apiKey : this.config.openaiEmbedding.apiKey; 
  }
  set embedApiKey(v: string) {
    if (this.config.embeddingProvider === 'gemini') this.config.gemini.apiKey = v;
    else this.config.openaiEmbedding.apiKey = v;
  }

  get embedModelId(): string {
    return this.config.embeddingProvider === 'gemini' ? this.config.gemini.embeddingModel : this.config.openaiEmbedding.model;
  }
  set embedModelId(v: string) {
    if (this.config.embeddingProvider === 'gemini') this.config.gemini.embeddingModel = v;
    else this.config.openaiEmbedding.model = v;
  }


  // --- CHECK CONNECTION LOGIC ---

  async checkChatModels() {
    this.isFetchingChat.set(true);
    this.chatStatus.set('Connecting...');
    this.chatError.set(false);
    this.fetchedChatModels.set([]);

    try {
      const provider = this.config.chatProvider;
      // Use the visible inputs!
      const url = this.chatBaseUrl;
      const key = this.chatApiKey;

      await this.executeFetch(provider, url, key, (models) => {
        this.fetchedChatModels.set(models);
        this.chatStatus.set(`Success! Found ${models.length} models.`);
      });
    } catch (e: any) {
      this.chatError.set(true);
      this.chatStatus.set(`Error: ${e.message}`);
    } finally {
      this.isFetchingChat.set(false);
    }
  }

  async checkEmbedModels() {
    this.isFetchingEmbed.set(true);
    this.embedStatus.set('Connecting...');
    this.embedError.set(false);
    this.fetchedEmbedModels.set([]);

    try {
      const provider = this.config.embeddingProvider;
      const url = this.embedBaseUrl;
      const key = this.embedApiKey;

      await this.executeFetch(provider, url, key, (models) => {
        this.fetchedEmbedModels.set(models);
        this.embedStatus.set(`Success! Found ${models.length} models.`);
      });
    } catch (e: any) {
      this.embedError.set(true);
      this.embedStatus.set(`Error: ${e.message}`);
    } finally {
      this.isFetchingEmbed.set(false);
    }
  }

  private async executeFetch(
    provider: LlmProvider, 
    baseUrl: string, 
    apiKey: string, 
    onSuccess: (models: string[]) => void
  ) {
    let fetchUrl = '';
    const headers: any = {};

    // Standardize URL formatting
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    if (provider === 'gemini') {
      // Google REST Check
      // We use the base URL from the input to respect "editable" requirement, 
      // but append /models?key=...
      // Usually cleanBase is "https://generativelanguage.googleapis.com/v1beta"
      fetchUrl = `${cleanBase}/models?key=${apiKey}`;
    } else {
      // OpenAI REST Check
      fetchUrl = `${cleanBase}/models`;
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Safety timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(fetchUrl, { 
      method: 'GET', 
      headers, 
      signal: controller.signal 
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      // Try to read error body
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} ${txt.slice(0, 100)}`);
    }

    const body = await res.json();
    let ids: string[] = [];

    if (provider === 'gemini') {
      if (body.models && Array.isArray(body.models)) {
        ids = body.models.map((m: any) => m.name.replace('models/', ''));
      }
    } else {
      const list = Array.isArray(body) ? body : (body.data || []);
      if (!Array.isArray(list)) throw new Error('Unexpected JSON format (no list found)');
      ids = list.map((item: any) => item.id);
    }

    if (ids.length > 0) {
      onSuccess(ids.sort());
    } else {
      throw new Error('Connection successful, but no models returned.');
    }
  }

  onBackdropClick() { this.close.emit(); }
  cancel() { this.close.emit(); }
  save() { 
    this.llmService.updateConfig(this.config);
    this.close.emit();
  }
}