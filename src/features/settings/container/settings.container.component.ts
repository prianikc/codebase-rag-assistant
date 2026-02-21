import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LlmService } from '../../../shared/services';
import { LlmConfig, LlmProvider } from '../../../core/models/llm.model';
import { ProviderInfo } from '../../../core/models';
import { PROVIDERS, EMBEDDING_PROVIDERS, getProviderById } from '../../../core/constants/providers.const';
import { STORAGE_KEYS } from '../../../core/constants/storage-keys.const';

import { ProviderConfigComponent } from '../components/provider-config/provider-config.component';
import { SpeechConfigComponent } from '../components/speech-config/speech-config.component';
import { SetupGuideComponent } from '../components/setup-guide/setup-guide.component';

type SettingsTab = 'chat' | 'embedding' | 'speech' | 'guide';

@Component({
  selector: 'app-settings-container',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ProviderConfigComponent,
    SpeechConfigComponent,
    SetupGuideComponent,
  ],
  templateUrl: './settings.container.component.html',
  styleUrl: './settings.container.component.css',
})
export class SettingsContainerComponent {
  private readonly llmService = inject(LlmService);

  close = output<void>();

  config: LlmConfig = JSON.parse(JSON.stringify(this.llmService.config()));

  providers = PROVIDERS;
  embeddingProviders = EMBEDDING_PROVIDERS;

  activeTab: SettingsTab = 'chat';

  selectedChatProvider = '';
  selectedEmbedProvider = '';

  showChatKey = false;
  showEmbedKey = false;

  // Autocomplete
  showChatDropdown = false;
  showEmbedDropdown = false;
  chatFilterText = '';
  embedFilterText = '';

  // Speech settings
  sttProvider: 'browser' | 'openai' | 'groq' = 'browser';
  sttApiKey = '';
  sttModel = 'whisper-1';
  sttBaseUrl = 'https://api.openai.com/v1';
  sttLanguage = 'ru-RU';

  ttsProvider: 'browser' | 'openai' | 'elevenlabs' = 'browser';
  ttsApiKey = '';
  ttsModel = 'tts-1';
  ttsVoice = 'alloy';
  ttsBaseUrl = 'https://api.openai.com/v1';
  ttsRate = 1.0;

  // Status
  isFetchingChat = signal(false);
  fetchedChatModels = signal<string[]>([]);
  chatStatus = signal('');
  chatError = signal(false);

  isFetchingEmbed = signal(false);
  fetchedEmbedModels = signal<string[]>([]);
  embedStatus = signal('');
  embedError = signal(false);

  constructor() {
    this.detectPresets();
    this.loadSpeechSettings();
  }

  get activeChatProviderInfo(): ProviderInfo | null {
    return getProviderById(this.selectedChatProvider) || null;
  }

  get activeEmbedProviderInfo(): ProviderInfo | null {
    return getProviderById(this.selectedEmbedProvider) || null;
  }

  // ─── Preset detection ───

  private detectPresets(): void {
    if (this.config.chatProvider === 'gemini') {
      this.selectedChatProvider = 'google';
    } else {
      const url = this.config.openaiChat.baseUrl;
      if (url.includes('openai.com')) this.selectedChatProvider = 'openai';
      else if (url.includes('openrouter.ai')) this.selectedChatProvider = 'openrouter';
      else if (url.includes('groq.com')) this.selectedChatProvider = 'groq';
      else if (url.includes('anthropic.com')) this.selectedChatProvider = 'anthropic';
      else if (url.includes('mistral.ai')) this.selectedChatProvider = 'mistral';
      else if (url.includes('deepseek.com')) this.selectedChatProvider = 'deepseek';
      else if (url.includes('11434')) this.selectedChatProvider = 'ollama';
      else if (url.includes('1234')) this.selectedChatProvider = 'lmstudio';
    }

    if (this.config.embeddingProvider === 'gemini') {
      this.selectedEmbedProvider = 'google';
    } else {
      const url = this.config.openaiEmbedding.baseUrl;
      if (url.includes('openai.com')) this.selectedEmbedProvider = 'openai';
      else if (url.includes('11434')) this.selectedEmbedProvider = 'ollama';
      else if (url.includes('mistral.ai')) this.selectedEmbedProvider = 'mistral';
      else if (url.includes('1234')) this.selectedEmbedProvider = 'lmstudio';
    }
  }

  // ─── Provider selection ───

  selectChatProvider(id: string): void {
    this.selectedChatProvider = id;
    const p = getProviderById(id)!;
    this.config.chatProvider = p.provider;

    if (p.provider === 'gemini') {
      this.config.gemini.chatModel = p.chatModels[0] || '';
    } else {
      this.config.openaiChat.baseUrl = p.baseUrl;
      this.config.openaiChat.model = p.chatModels[0] || '';
    }

    this.fetchedChatModels.set([]);
    this.chatStatus.set('');
  }

  selectEmbedProvider(id: string): void {
    this.selectedEmbedProvider = id;
    const p = getProviderById(id)!;
    this.config.embeddingProvider = p.provider;

    if (p.provider === 'gemini') {
      this.config.gemini.embeddingModel = p.embeddingModels[0] || '';
    } else {
      this.config.openaiEmbedding.baseUrl = p.baseUrl;
      this.config.openaiEmbedding.model = p.embeddingModels[0] || '';
    }

    this.fetchedEmbedModels.set([]);
    this.embedStatus.set('');
  }

  // ─── Getters / Setters ───

  get chatBaseUrl(): string {
    return this.config.openaiChat.baseUrl;
  }
  set chatBaseUrl(v: string) {
    this.config.openaiChat.baseUrl = v;
  }

  get chatApiKey(): string {
    return this.config.chatProvider === 'gemini'
      ? this.config.gemini.apiKey
      : this.config.openaiChat.apiKey;
  }
  set chatApiKey(v: string) {
    if (this.config.chatProvider === 'gemini') {
      this.config.gemini.apiKey = v;
    } else {
      this.config.openaiChat.apiKey = v;
    }
  }

  get chatModelId(): string {
    return this.config.chatProvider === 'gemini'
      ? this.config.gemini.chatModel
      : this.config.openaiChat.model;
  }
  set chatModelId(v: string) {
    if (this.config.chatProvider === 'gemini') {
      this.config.gemini.chatModel = v;
    } else {
      this.config.openaiChat.model = v;
    }
  }

  get embedBaseUrl(): string {
    return this.config.openaiEmbedding.baseUrl;
  }
  set embedBaseUrl(v: string) {
    this.config.openaiEmbedding.baseUrl = v;
  }

  get embedApiKey(): string {
    return this.config.embeddingProvider === 'gemini'
      ? this.config.gemini.apiKey
      : this.config.openaiEmbedding.apiKey;
  }
  set embedApiKey(v: string) {
    if (this.config.embeddingProvider === 'gemini') {
      this.config.gemini.apiKey = v;
    } else {
      this.config.openaiEmbedding.apiKey = v;
    }
  }

  get embedModelId(): string {
    return this.config.embeddingProvider === 'gemini'
      ? this.config.gemini.embeddingModel
      : this.config.openaiEmbedding.model;
  }
  set embedModelId(v: string) {
    if (this.config.embeddingProvider === 'gemini') {
      this.config.gemini.embeddingModel = v;
    } else {
      this.config.openaiEmbedding.model = v;
    }
  }

  // ─── Autocomplete filters ───

  private filterModels(models: string[], filterText: string): string[] {
    if (!filterText) return models;
    const lower = filterText.toLowerCase();
    return models.filter((m) => m.toLowerCase().includes(lower));
  }

  filteredFetchedChat(): string[] {
    return this.filterModels(this.fetchedChatModels(), this.chatFilterText);
  }

  filteredPresetChat(): string[] {
    const presets = this.activeChatProviderInfo?.chatModels || [];
    if (presets.length === 0) return [];
    const fetchedSet = new Set(this.fetchedChatModels());
    const unique = presets.filter((m) => !fetchedSet.has(m));
    return this.filterModels(unique, this.chatFilterText);
  }

  filteredFetchedEmbed(): string[] {
    return this.filterModels(this.fetchedEmbedModels(), this.embedFilterText);
  }

  filteredPresetEmbed(): string[] {
    const presets = this.activeEmbedProviderInfo?.embeddingModels || [];
    if (presets.length === 0) return [];
    const fetchedSet = new Set(this.fetchedEmbedModels());
    const unique = presets.filter((m) => !fetchedSet.has(m));
    return this.filterModels(unique, this.embedFilterText);
  }

  // ─── Model discovery ───

  async checkChatModels(): Promise<void> {
    this.isFetchingChat.set(true);
    this.chatStatus.set('Подключение...');
    this.chatError.set(false);
    this.fetchedChatModels.set([]);

    try {
      await this.executeFetch(
        this.config.chatProvider,
        this.chatBaseUrl,
        this.chatApiKey,
        (models) => {
          this.fetchedChatModels.set(models);
          this.chatStatus.set(`✓ Подключено. Найдено ${models.length} моделей.`);
        }
      );
    } catch (e: unknown) {
      this.chatError.set(true);
      this.chatStatus.set(`Ошибка: ${e instanceof Error ? e.message : 'Неизвестная ошибка'}`);
    } finally {
      this.isFetchingChat.set(false);
    }
  }

  async checkEmbedModels(): Promise<void> {
    this.isFetchingEmbed.set(true);
    this.embedStatus.set('Подключение...');
    this.embedError.set(false);
    this.fetchedEmbedModels.set([]);

    try {
      await this.executeFetch(
        this.config.embeddingProvider,
        this.embedBaseUrl,
        this.embedApiKey,
        (models) => {
          this.fetchedEmbedModels.set(models);
          this.embedStatus.set(`✓ Подключено. Найдено ${models.length} моделей.`);
        }
      );
    } catch (e: unknown) {
      this.embedError.set(true);
      this.embedStatus.set(`Ошибка: ${e instanceof Error ? e.message : 'Неизвестная ошибка'}`);
    } finally {
      this.isFetchingEmbed.set(false);
    }
  }

  private async executeFetch(
    provider: LlmProvider,
    baseUrl: string,
    apiKey: string,
    onSuccess: (models: string[]) => void
  ): Promise<void> {
    let fetchUrl = '';
    const headers: Record<string, string> = {};
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    if (provider === 'gemini') {
      fetchUrl = `${cleanBase}/models?key=${apiKey}`;
    } else {
      fetchUrl = `${cleanBase}/models`;
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(fetchUrl, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      let msg = `HTTP ${res.status}`;
      try {
        const p = JSON.parse(txt);
        if (p.error?.message) msg = p.error.message;
      } catch {
        msg += ': ' + txt.slice(0, 100);
      }
      throw new Error(msg);
    }

    const body = await res.json();
    let ids: string[] = [];

    if (provider === 'gemini') {
      if (body.models && Array.isArray(body.models)) {
        ids = body.models.map((m: { name: string }) => m.name.replace('models/', ''));
      }
    } else {
      const list = Array.isArray(body) ? body : body.data || [];
      if (!Array.isArray(list)) throw new Error('Неожиданный формат ответа');
      ids = list.map((item: { id: string }) => item.id);
    }

    if (ids.length > 0) {
      onSuccess(ids.sort());
    } else {
      throw new Error('Подключение успешно, но моделей не найдено.');
    }
  }

  // ─── Speech settings persistence ───

  private loadSpeechSettings(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SPEECH);
      if (raw) {
        const s = JSON.parse(raw);
        this.sttProvider = s.sttProvider || 'browser';
        this.sttApiKey = s.sttApiKey || '';
        this.sttModel = s.sttModel || 'whisper-1';
        this.sttBaseUrl = s.sttBaseUrl || 'https://api.openai.com/v1';
        this.sttLanguage = s.sttLanguage || 'ru-RU';
        this.ttsProvider = s.ttsProvider || 'browser';
        this.ttsApiKey = s.ttsApiKey || '';
        this.ttsModel = s.ttsModel || 'tts-1';
        this.ttsVoice = s.ttsVoice || 'alloy';
        this.ttsBaseUrl = s.ttsBaseUrl || 'https://api.openai.com/v1';
        this.ttsRate = s.ttsRate || 1.0;
      }
    } catch {
      // ignore
    }
  }

  saveSpeechSettings(): void {
    localStorage.setItem(
      STORAGE_KEYS.SPEECH,
      JSON.stringify({
        sttProvider: this.sttProvider,
        sttApiKey: this.sttApiKey,
        sttModel: this.sttModel,
        sttBaseUrl: this.sttBaseUrl,
        sttLanguage: this.sttLanguage,
        ttsProvider: this.ttsProvider,
        ttsApiKey: this.ttsApiKey,
        ttsModel: this.ttsModel,
        ttsVoice: this.ttsVoice,
        ttsBaseUrl: this.ttsBaseUrl,
        ttsRate: this.ttsRate,
      })
    );
  }

  // ─── Actions ───

  onBackdropClick(): void {
    this.close.emit();
  }

  cancel(): void {
    this.close.emit();
  }

  save(): void {
    this.llmService.updateConfig(this.config);
    this.saveSpeechSettings();
    this.close.emit();
  }
}
