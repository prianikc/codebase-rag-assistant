import { Component, input, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-chat-input",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./chat-input.component.html",
  styleUrl: "./chat-input.component.css",
})
export class ChatInputComponent {
  value = input<string>("");
  useRag = input<boolean>(true);
  disabled = input<boolean>(false);
  docCount = input<number>(0);

  valueChange = output<string>();
  useRagChange = output<boolean>();
  send = output<void>();

  onEnter(event: Event): void {
    event.preventDefault();
    if (this.value().trim() && !this.disabled()) {
      this.send.emit();
    }
  }

  autoResize(event: Event): void {
    const ta = event.target as HTMLTextAreaElement;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 300) + "px";
    ta.style.overflow = ta.scrollHeight > 300 ? "auto" : "hidden";
  }
}
