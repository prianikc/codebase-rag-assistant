import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProviderInfo } from '../../../../core/models';

@Component({
    selector: 'app-provider-config',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './provider-config.component.html',
    styleUrl: './provider-config.component.css',
})
export class ProviderConfigComponent {
    // Inputs
    type = input<'chat' | 'embedding'>('chat');
    sectionTitle = input<string>('');
    hint = input<string>('');

    providers = input<ProviderInfo[]>([]);
    selectedProviderId = input<string>('');
    providerInfo = input<ProviderInfo | null>(null);

    baseUrl = input<string>('');
    apiKey = input<string>('');
    modelId = input<string>('');
    showKey = input<boolean>(false);
    showDropdown = input<boolean>(false);
    filterText = input<string>('');

    fetchedModels = input<string[]>([]);
    filteredFetched = input<string[]>([]);
    filteredPreset = input<string[]>([]);

    isFetching = input<boolean>(false);
    status = input<string>('');
    hasError = input<boolean>(false);

    // Outputs
    providerSelected = output<string>();
    baseUrlChange = output<string>();
    apiKeyChange = output<string>();
    modelIdChange = output<string>();
    showKeyChange = output<boolean>();
    showDropdownChange = output<boolean>();
    filterTextChange = output<string>();
    checkModels = output<void>();

    onModelInput(value: string): void {
        this.modelIdChange.emit(value);
        this.filterTextChange.emit(value);
    }

    selectModel(model: string): void {
        this.modelIdChange.emit(model);
        this.showDropdownChange.emit(false);
    }
}
