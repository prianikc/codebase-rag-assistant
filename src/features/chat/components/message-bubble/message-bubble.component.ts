import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownPipe } from '../../../../shared/pipes';
import { ChatSource } from '../../../../core/models';

@Component({
    selector: 'app-message-bubble',
    standalone: true,
    imports: [CommonModule, MarkdownPipe],
    templateUrl: './message-bubble.component.html',
    styleUrl: './message-bubble.component.css',
})
export class MessageBubbleComponent {
    role = input.required<'user' | 'assistant' | 'system'>();
    content = input.required<string>();
    timestamp = input.required<Date>();
    sources = input<ChatSource[]>();
    isStreaming = input<boolean>(false);
}
