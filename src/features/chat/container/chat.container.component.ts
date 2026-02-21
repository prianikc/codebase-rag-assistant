import {
  Component,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  computed,
  effect,
  input,
  output,
  untracked,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { LlmService, VectorStoreService } from "../../../shared/services";
import { ChatHistoryService, RagService } from "../services";
import { SettingsContainerComponent } from "../../settings/container/settings.container.component";
import { MessageBubbleComponent } from "../components/message-bubble/message-bubble.component";
import { ChatInputComponent } from "../components/chat-input/chat-input.component";
import { extractErrorMessage } from "../../../shared/utils/error.utils";

@Component({
  selector: "app-chat-container",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SettingsContainerComponent,
    MessageBubbleComponent,
    ChatInputComponent,
  ],
  templateUrl: "./chat.container.component.html",
  styleUrl: "./chat.container.component.css",
  host: {
    style:
      "display:flex;flex-direction:column;height:100%;width:100%;min-height:0;",
  },
})
export class ChatContainerComponent implements AfterViewChecked {
  public llmService = inject(LlmService);
  public vectorStore = inject(VectorStoreService);
  public chatService = inject(ChatHistoryService);
  private ragService = inject(RagService);

  @ViewChild("scrollContainer") private scrollContainer!: ElementRef;
  private hostEl = inject(ElementRef);

  userInput = "";

  messages = computed(() => this.chatService.currentSession()?.messages || []);
  currentSessionTitle = computed(
    () => this.chatService.currentSession()?.title || "Новый чат",
  );

  lastMessage = computed(() => {
    const msgs = this.messages();
    return msgs.length > 0 ? msgs[msgs.length - 1] : null;
  });

  isGenerating = signal(false);
  step = signal<"idle" | "retrieving" | "generating">("idle");
  showSettings = false;

  useRag = true;

  presets = [
    "Расскажи о проекте!",
    "Покажи кусок кода со сложной логикой!",
    "Какова структура проекта?",
    "Как запустить проект?",
  ];

  /** Code snippet coming from the file viewer */
  pendingSnippet = input<string>("");
  snippetConsumed = output<void>();

  constructor() {
    effect(() => {
      this.messages();
      setTimeout(() => this.scrollToBottom(), 50);
    });

    // Watch for incoming code snippets from file viewer
    effect(() => {
      const snippet = this.pendingSnippet();
      if (snippet) {
        untracked(() => {
          const current = this.userInput;
          this.userInput = current
            ? current + "\n\n" + snippet + "\n"
            : snippet + "\n";
          this.snippetConsumed.emit();
          // Auto-resize and focus after DOM update
          setTimeout(() => this.focusAndResizeInput(), 50);
        });
      }
    });
  }

  modelLabel = computed(() => {
    const c = this.llmService.config();
    const isGemini = c.chatProvider === "gemini";
    const modelName = isGemini ? c.gemini.chatModel : c.openaiChat.model;
    const color = isGemini
      ? "color:var(--accent-success)"
      : "color:var(--accent-secondary)";
    return `<span style="${color};font-weight:700;font-size:11px;">${modelName.toUpperCase()}</span>`;
  });

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  usePreset(text: string): void {
    this.userInput = text;
    this.useRag = true;
    this.triggerSend();
  }

  sendMessage(event?: Event): void {
    if (event) event.preventDefault();
    this.triggerSend();
  }

  exportChat(): void {
    const msgs = this.messages();
    if (msgs.length === 0) return;

    const title = this.currentSessionTitle();
    let md = `# ${title}\n\n`;

    for (const msg of msgs) {
      const time =
        msg.timestamp instanceof Date
          ? msg.timestamp.toLocaleTimeString()
          : new Date(msg.timestamp).toLocaleTimeString();
      md += `## ${msg.role.toUpperCase()} — ${time}\n\n${msg.content}\n\n---\n\n`;
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Zа-яА-Я0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async triggerSend(): Promise<void> {
    if (!this.userInput.trim() || this.isGenerating()) return;

    const userText = this.userInput;
    this.userInput = "";

    this.chatService.addMessageToCurrent({
      role: "user",
      content: userText,
      timestamp: new Date(),
    });

    this.isGenerating.set(true);

    let ragContext = null;

    try {
      // RAG retrieval via dedicated service
      if (this.useRag && this.ragService.hasDocuments) {
        this.step.set("retrieving");
        try {
          ragContext = await this.ragService.retrieveContext(userText);
        } catch (searchError: unknown) {
          console.error("RAG Search Failed", searchError);
        }
      }

      this.step.set("generating");

      const systemPrompt = this.ragService.buildSystemPrompt(
        userText,
        ragContext,
      );

      this.chatService.addMessageToCurrent({
        role: "assistant",
        content: "",
        sources: ragContext?.sources.length ? ragContext.sources : undefined,
        timestamp: new Date(),
      });

      const historyForLlm = this.messages()
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      let fullContent = "";

      try {
        for await (const chunk of this.llmService.generateCompletionStream(
          historyForLlm,
          systemPrompt,
        )) {
          fullContent += chunk;
          this.chatService.updateLastMessage(fullContent);
          this.scrollToBottom();
        }
      } catch (streamError: unknown) {
        const errMsg = extractErrorMessage(streamError);
        const errorBlock = fullContent
          ? fullContent + `\n\n---\n\n> **⚠️ Ошибка потока**\n> ${errMsg}`
          : `> **⚠️ Ошибка**\n> ${errMsg}\n\nПроверьте API ключ, модель и URL эндпоинта в **Настройках**.`;
        this.chatService.updateLastMessage(errorBlock);
      }
    } catch (error: unknown) {
      const errMsg = extractErrorMessage(error);
      this.chatService.addMessageToCurrent({
        role: "assistant",
        content: `> **❌ Системная ошибка**\n> ${errMsg}\n\nПроверьте конфигурацию в **Настройках**.`,
        timestamp: new Date(),
      });
    } finally {
      this.isGenerating.set(false);
      this.step.set("idle");
    }
  }

  focusAndResizeInput(): void {
    try {
      const ta = this.hostEl.nativeElement.querySelector(
        ".input-field",
      ) as HTMLTextAreaElement;
      if (!ta) return;
      // Auto-resize: reset height then set to scrollHeight
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 300) + "px";
      ta.style.overflow = ta.scrollHeight > 300 ? "auto" : "hidden";
      // Focus and place cursor at end
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      // Scroll textarea to bottom
      ta.scrollTop = ta.scrollHeight;
    } catch (_err) {
      /* ignore */
    }
  }

  ngAfterViewChecked(): void {
    if (this.isGenerating()) {
      this.scrollToBottom();
    }
  }

  scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        const el = this.scrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    } catch (_err) {
      /* ignore */
    }
  }
}
