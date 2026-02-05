import { Component, inject, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LlmService } from '../services/llm.service';
import { KnowledgeBaseService } from '../services/knowledge-base.service';
import { MarkdownPipe } from '../services/markdown.pipe';
import { SettingsModalComponent } from './settings-modal.component';
import { VectorStoreService } from '../services/vector-store.service';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: string[];
  timestamp: Date;
}

@Component({
  selector: 'app-chat-interface',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe, SettingsModalComponent],
  template: `
    <div class="flex flex-col h-full bg-slate-900 text-slate-200 relative">
      <!-- Settings Modal -->
      @if (showSettings) {
        <app-settings-modal (close)="toggleSettings()"></app-settings-modal>
      }

      <!-- Header -->
      <header class="p-4 border-b border-slate-700 bg-slate-950 flex justify-between items-center shadow-md z-10">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></div>
          <div>
            <h2 class="text-lg font-mono font-bold text-green-400 tracking-tight">RAG_TERMINAL</h2>
            <div class="text-[10px] text-slate-500 font-mono flex gap-2">
              <span>VECTORS: {{ vectorStore.docCount() }}</span>
              <span>MEM: {{ vectorStore.memoryUsage() }}</span>
            </div>
          </div>
        </div>
        
        <button 
          (click)="toggleSettings()"
          class="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded text-xs font-mono text-slate-300 transition-all">
          <span [class]="llmService.config().provider === 'gemini' ? 'text-green-400' : 'text-blue-400'">
             ● {{ llmService.config().provider | uppercase }}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto p-4 space-y-6" #scrollContainer>
        @if (messages().length === 0) {
          <div class="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
            <div class="border border-slate-700 p-8 rounded-full bg-slate-900/50 mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
               </svg>
            </div>
            <p class="font-mono text-sm">System Ready.</p>
            <p class="font-mono text-xs mt-2">1. Ingest Files (Vectorize)</p>
            <p class="font-mono text-xs">2. Connect LLM (Settings)</p>
            <p class="font-mono text-xs">3. Query Context</p>
          </div>
        }

        @for (msg of messages(); track msg.timestamp) {
          <div [class]="'flex ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')">
            <div [class]="'max-w-[85%] rounded-lg p-4 font-sans leading-relaxed shadow-lg border ' + 
                          (msg.role === 'user' ? 'bg-blue-900/40 border-blue-700/50 text-blue-50' : 'bg-slate-800 border-slate-700/50')">
              
              <!-- Message Header -->
              <div class="flex items-center gap-2 mb-2 pb-2 border-b border-white/5 text-[10px] font-mono opacity-60">
                <span class="font-bold uppercase">{{ msg.role }}</span>
                <span>{{ msg.timestamp | date:'HH:mm:ss' }}</span>
              </div>

              <!-- Content -->
              <div [innerHTML]="msg.content | markdown"></div>

              <!-- Sources (RAG Citation) -->
              @if (msg.sources && msg.sources.length > 0) {
                <div class="mt-4 pt-2 border-t border-white/5">
                  <p class="text-[10px] font-mono text-green-500 mb-1 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                    CONTEXT_RETRIEVED
                  </p>
                  <div class="flex flex-wrap gap-2">
                    @for (source of msg.sources; track source) {
                      <span class="text-[10px] bg-slate-950/50 px-2 py-1 rounded border border-slate-700/50 text-slate-400 font-mono">
                        {{ source }}
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }

        @if (isGenerating()) {
          <div class="flex justify-start">
            <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex items-center gap-3">
              <div class="flex space-x-1">
                 <span class="relative flex h-3 w-3">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
              </div>
              <span class="text-xs font-mono text-green-400">
                @if (step() === 'retrieving') { SEARCHING VECTOR SPACE... }
                @else { GENERATING RESPONSE... }
              </span>
            </div>
          </div>
        }
      </div>

      <!-- Input Area -->
      <div class="p-4 bg-slate-950 border-t border-slate-800">
        <div class="flex gap-2 relative">
          <textarea 
            [(ngModel)]="userInput" 
            (keydown.enter)="sendMessage($event)"
            placeholder="Enter instruction..."
            rows="1"
            class="w-full bg-slate-900 border border-slate-700 rounded-md py-3 px-4 text-slate-200 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all font-mono resize-none overflow-hidden"
            style="min-height: 50px;"
          ></textarea>
          
          <button 
            (click)="triggerSend()"
            [disabled]="isGenerating() || !userInput.trim()"
            class="px-6 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-md transition-colors flex items-center justify-center shadow-lg shadow-green-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `
})
export class ChatInterfaceComponent implements AfterViewChecked {
  public llmService = inject(LlmService);
  public kbService = inject(KnowledgeBaseService);
  public vectorStore = inject(VectorStoreService);
  
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  userInput = '';
  messages = signal<Message[]>([]);
  isGenerating = signal(false);
  step = signal<'idle' | 'retrieving' | 'generating'>('idle');
  showSettings = false;

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  sendMessage(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.triggerSend();
  }

  async triggerSend() {
    if (!this.userInput.trim() || this.isGenerating()) return;

    const userText = this.userInput;
    this.userInput = '';

    this.addMessage({ role: 'user', content: userText, timestamp: new Date() });
    this.isGenerating.set(true);
    this.step.set('retrieving');

    try {
      // 1. Vector Search (RAG)
      const relevantChunks = await this.kbService.search(userText);
      // Fix: Ensure sources is explicitly a string array using Array.from to handle Set iteration correctly in all environments
      const sources: string[] = Array.from(new Set(relevantChunks.map(c => c.source)));
      
      let contextBlock = '';
      if (relevantChunks.length > 0) {
        contextBlock = relevantChunks.map(c => 
          `FILENAME: ${c.source}\nCONTENT:\n${c.content}\n---`
        ).join('\n');
      } else {
        contextBlock = "No specific code context found.";
      }

      this.step.set('generating');

      // 2. LLM Generation
      const systemPrompt = `You are an advanced software engineer.
User Query: ${userText}

Here is the retrieved code context from the vector database:
${contextBlock}

Instructions:
- Use the context to answer the query accurately.
- If the context contains the answer, cite the filename.
- If the context is irrelevant, answer based on general knowledge but mention that context was missing.
`;

      const responseText = await this.llmService.generateCompletion(
        this.messages().map(m => ({ role: m.role, content: m.content })),
        systemPrompt
      );

      this.addMessage({
        role: 'assistant',
        content: responseText,
        sources: sources.length > 0 ? sources : undefined,
        timestamp: new Date()
      });

    } catch (error) {
      this.addMessage({
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown failure'}`,
        timestamp: new Date()
      });
    } finally {
      this.isGenerating.set(false);
      this.step.set('idle');
    }
  }

  addMessage(msg: Message) {
    this.messages.update(msgs => [...msgs, msg]);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }
}