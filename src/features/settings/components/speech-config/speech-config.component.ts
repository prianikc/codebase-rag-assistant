import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-speech-config',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './speech-config.component.html',
    styleUrl: './speech-config.component.css',
})
export class SpeechConfigComponent {
    // STT inputs
    sttProvider = input<'browser' | 'openai' | 'groq'>('browser');
    sttApiKey = input<string>('');
    sttModel = input<string>('whisper-1');
    sttBaseUrl = input<string>('https://api.openai.com/v1');
    sttLanguage = input<string>('ru-RU');

    // TTS inputs
    ttsProvider = input<'browser' | 'openai' | 'elevenlabs'>('browser');
    ttsApiKey = input<string>('');
    ttsModel = input<string>('tts-1');
    ttsVoice = input<string>('alloy');
    ttsBaseUrl = input<string>('https://api.openai.com/v1');
    ttsRate = input<number>(1.0);

    // STT outputs
    sttProviderChange = output<'browser' | 'openai' | 'groq'>();
    sttApiKeyChange = output<string>();
    sttModelChange = output<string>();
    sttBaseUrlChange = output<string>();
    sttLanguageChange = output<string>();

    // TTS outputs
    ttsProviderChange = output<'browser' | 'openai' | 'elevenlabs'>();
    ttsApiKeyChange = output<string>();
    ttsModelChange = output<string>();
    ttsVoiceChange = output<string>();
    ttsBaseUrlChange = output<string>();
    ttsRateChange = output<number>();
}
