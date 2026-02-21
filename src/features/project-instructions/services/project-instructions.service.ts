import { Injectable, signal, inject, computed } from '@angular/core';
import { LlmService, VectorStoreService } from '../../../shared/services';

export type InstructionStatus = 'pending' | 'generating' | 'done' | 'error';

export interface FileInstruction {
    filePath: string;
    fileName: string;
    instruction: string;
    status: InstructionStatus;
    error?: string;
}

export interface FolderInstruction {
    folderPath: string;
    files: string[];
    instruction: string;
    status: InstructionStatus;
    error?: string;
    fileInstructions: Map<string, FileInstruction>;
}

@Injectable({
    providedIn: 'root'
})
export class ProjectInstructionsService {
    private llmService = inject(LlmService);
    private vectorStore = inject(VectorStoreService);

    // --- STATE ---
    public instructions = signal<Map<string, FolderInstruction>>(new Map());
    public isGenerating = signal<boolean>(false);
    public progressStatus = signal<string>('');
    public selectedItem = signal<{ type: 'folder' | 'file'; path: string } | null>(null);

    /** @deprecated — use selectedItem() */
    public selectedFolder = signal<string | null>(null);

    public folderPaths = computed(() => {
        const map = this.instructions();
        return Array.from(map.keys()).sort();
    });

    public totalFolders = computed(() => this.folderPaths().length);
    public completedFolders = computed(() => {
        const map = this.instructions();
        let count = 0;
        map.forEach(v => { if (v.status === 'done') count++; });
        return count;
    });

    public totalItems = computed(() => {
        const map = this.instructions();
        let count = map.size;
        map.forEach(fi => { count += fi.files.length; });
        return count;
    });

    public completedItems = computed(() => {
        const map = this.instructions();
        let count = 0;
        map.forEach(fi => {
            if (fi.status === 'done') count++;
            fi.fileInstructions.forEach(f => { if (f.status === 'done') count++; });
        });
        return count;
    });

    public progress = computed(() => {
        const total = this.totalItems();
        if (total === 0) return 0;
        return Math.round((this.completedItems() / total) * 100);
    });

    // --- API ---

    /**
     * Build folder structure, generate instructions for each folder AND each file.
     */
    async generateAll() {
        if (this.isGenerating()) return;

        const docs = this.vectorStore.getAllDocuments();
        if (docs.length === 0) {
            this.progressStatus.set('Нет загруженных файлов. Сначала загрузите проект.');
            return;
        }

        this.isGenerating.set(true);

        try {
            // 1. Group files by folder
            const folderMap = new Map<string, { path: string, content: string }[]>();

            for (const doc of docs) {
                const parts = doc.filePath.split('/');
                const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';

                if (!folderMap.has(folderPath)) {
                    folderMap.set(folderPath, []);
                }

                const existing = folderMap.get(folderPath)!;
                const alreadyExists = existing.some(f => f.path === doc.filePath);
                if (alreadyExists) {
                    const fileEntry = existing.find(f => f.path === doc.filePath)!;
                    fileEntry.content += '\n' + doc.content;
                } else {
                    existing.push({ path: doc.filePath, content: doc.content });
                }
            }

            // 2. Initialize instructions map
            const instructionsMap = new Map<string, FolderInstruction>();
            for (const [folderPath, files] of folderMap) {
                const fileInstructions = new Map<string, FileInstruction>();
                for (const file of files) {
                    const fileName = file.path.split('/').pop() || file.path;
                    fileInstructions.set(file.path, {
                        filePath: file.path,
                        fileName,
                        instruction: '',
                        status: 'pending'
                    });
                }
                instructionsMap.set(folderPath, {
                    folderPath,
                    files: files.map(f => f.path),
                    instruction: '',
                    status: 'pending',
                    fileInstructions
                });
            }
            this.instructions.set(new Map(instructionsMap));

            // 3. Generate sequentially: folder, then its files
            const folders = Array.from(folderMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            let processedFolders = 0;

            for (const [folderPath, files] of folders) {
                processedFolders++;

                // 3a. Generate folder instruction
                this.progressStatus.set(`📁 ${processedFolders}/${folders.length}: ${folderPath}`);
                try {
                    await this.generateForFolder(folderPath, files, instructionsMap);
                } catch (err: any) {
                    const fi = instructionsMap.get(folderPath)!;
                    fi.status = 'error';
                    fi.error = err.message || 'Unknown error';
                    instructionsMap.set(folderPath, fi);
                    this.instructions.set(new Map(instructionsMap));
                }

                // 3b. Generate file instructions
                for (const file of files) {
                    const fileName = file.path.split('/').pop() || file.path;
                    this.progressStatus.set(`📄 ${fileName} (${folderPath})`);
                    try {
                        await this.generateForFile(file.path, file.content, folderPath, instructionsMap);
                    } catch (err: any) {
                        const fi = instructionsMap.get(folderPath)!;
                        const fileInstr = fi.fileInstructions.get(file.path)!;
                        fileInstr.status = 'error';
                        fileInstr.error = err.message || 'Unknown error';
                        this.instructions.set(new Map(instructionsMap));
                    }
                }
            }

            this.progressStatus.set(`Готово! ${this.completedItems()}/${this.totalItems()} элементов`);

        } catch (err: any) {
            console.error('[ProjectInstructions] Error:', err);
            this.progressStatus.set(`Ошибка: ${err.message}`);
        } finally {
            this.isGenerating.set(false);
        }
    }

    /**
     * Generate instruction for a single folder.
     */
    async generateForFolder(
        folderPath: string,
        files: { path: string, content: string }[],
        instructionsMap: Map<string, FolderInstruction>
    ) {
        const fi = instructionsMap.get(folderPath)!;
        fi.status = 'generating';
        instructionsMap.set(folderPath, { ...fi, fileInstructions: fi.fileInstructions });
        this.instructions.set(new Map(instructionsMap));

        const fileList = files.map(f => f.path.split('/').pop() || f.path).join(', ');

        const maxContentPerFile = 3000;
        const fileContents = files.map(f => {
            const name = f.path.split('/').pop() || f.path;
            const content = f.content.length > maxContentPerFile
                ? f.content.substring(0, maxContentPerFile) + '\n... (truncated)'
                : f.content;
            return `### ${name}\n\`\`\`\n${content}\n\`\`\``;
        }).join('\n\n');

        const systemPrompt = `Ты архитектурный ассистент для анализа кодовых проектов. Отвечай на русском языке. Будь конкретен и полезен.`;

        const userPrompt = `Проанализируй папку "${folderPath}" проекта.

Файлы в папке: ${fileList}

Содержимое файлов:
${fileContents}

Сгенерируй подробную инструкцию по этой папке в формате markdown:

## 📁 Описание папки
Что это за папка, её назначение в проекте.

## 📄 Файлы
Для каждого файла: назначение, основные сущности (классы, функции, интерфейсы).

## 🏗️ Подход
Паттерны, принципы и стиль написания кода в этой папке.

## 💡 Советы по улучшению
Рекомендации по улучшению архитектуры, структуры или читаемости кода.

## ⚠️ Потенциальные проблемы
Логические ошибки, антипаттерны или потенциальные баги, если есть.`;

        const messages = [{ role: 'user', content: userPrompt }];
        const result = await this.llmService.generateCompletion(messages, systemPrompt);

        fi.instruction = result;
        fi.status = 'done';
        instructionsMap.set(folderPath, { ...fi, fileInstructions: fi.fileInstructions });
        this.instructions.set(new Map(instructionsMap));
    }

    /**
     * Generate a short instruction for a single file.
     */
    async generateForFile(
        filePath: string,
        content: string,
        folderPath: string,
        instructionsMap: Map<string, FolderInstruction>
    ) {
        const fi = instructionsMap.get(folderPath)!;
        const fileInstr = fi.fileInstructions.get(filePath)!;
        fileInstr.status = 'generating';
        this.instructions.set(new Map(instructionsMap));

        const fileName = filePath.split('/').pop() || filePath;
        const maxContent = 4000;
        const truncatedContent = content.length > maxContent
            ? content.substring(0, maxContent) + '\n... (truncated)'
            : content;

        const systemPrompt = `Ты ассистент-документатор. Отвечай кратко и по делу на русском. Только самая нужная информация.`;

        const userPrompt = `Опиши файл "${fileName}" (путь: ${filePath}).

Содержимое:
\`\`\`
${truncatedContent}
\`\`\`

Кратко опиши:
- **Назначение**: для чего этот файл, что он делает (1-2 предложения)
- **Основные сущности**: классы, функции, интерфейсы, константы — только имена и краткое описание каждой
- **Зависимости**: от чего зависит файл (ключевые импорты)

Формат: markdown, без лишней воды, максимально сжато.`;

        const messages = [{ role: 'user', content: userPrompt }];
        const result = await this.llmService.generateCompletion(messages, systemPrompt);

        fileInstr.instruction = result;
        fileInstr.status = 'done';
        this.instructions.set(new Map(instructionsMap));
    }

    /**
     * Regenerate instruction for a specific folder (and its files).
     */
    async regenerateFolder(folderPath: string) {
        if (this.isGenerating()) return;

        const docs = this.vectorStore.getAllDocuments();
        const folderFiles = new Map<string, string>();

        for (const doc of docs) {
            const parts = doc.filePath.split('/');
            const fp = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
            if (fp === folderPath) {
                if (folderFiles.has(doc.filePath)) {
                    folderFiles.set(doc.filePath, folderFiles.get(doc.filePath)! + '\n' + doc.content);
                } else {
                    folderFiles.set(doc.filePath, doc.content);
                }
            }
        }

        if (folderFiles.size === 0) return;

        this.isGenerating.set(true);
        this.progressStatus.set(`Перегенерация: ${folderPath}`);

        try {
            const files = Array.from(folderFiles.entries()).map(([path, content]) => ({ path, content }));
            const instructionsMap = new Map(this.instructions());

            // Regenerate folder
            await this.generateForFolder(folderPath, files, instructionsMap);

            // Regenerate each file
            for (const file of files) {
                const fileName = file.path.split('/').pop() || file.path;
                this.progressStatus.set(`📄 ${fileName}`);
                await this.generateForFile(file.path, file.content, folderPath, instructionsMap);
            }

            this.progressStatus.set('Готово!');
        } catch (err: any) {
            this.progressStatus.set(`Ошибка: ${err.message}`);
        } finally {
            this.isGenerating.set(false);
        }
    }

    /**
     * Regenerate instruction for a single file.
     */
    async regenerateFile(filePath: string) {
        if (this.isGenerating()) return;

        const docs = this.vectorStore.getAllDocuments();
        let content = '';
        let folderPath = '';

        for (const doc of docs) {
            if (doc.filePath === filePath) {
                content += (content ? '\n' : '') + doc.content;
                const parts = doc.filePath.split('/');
                folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
            }
        }

        if (!content || !folderPath) return;

        this.isGenerating.set(true);
        const fileName = filePath.split('/').pop() || filePath;
        this.progressStatus.set(`Перегенерация: ${fileName}`);

        try {
            const instructionsMap = new Map(this.instructions());
            await this.generateForFile(filePath, content, folderPath, instructionsMap);
            this.progressStatus.set('Готово!');
        } catch (err: any) {
            this.progressStatus.set(`Ошибка: ${err.message}`);
        } finally {
            this.isGenerating.set(false);
        }
    }

    /**
     * Export all instructions as a single markdown file.
     */
    exportAll() {
        const map = this.instructions();
        if (map.size === 0) return;

        let output = '# 📋 Инструкции по проекту\n\n';
        output += `> Сгенерировано: ${new Date().toLocaleString('ru-RU')}\n\n---\n\n`;

        const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        for (const [folderPath, fi] of sorted) {
            if (fi.status === 'done' && fi.instruction) {
                output += `# 📁 ${folderPath}\n\n`;
                output += fi.instruction + '\n\n';

                // Add file instructions
                const filesSorted = Array.from(fi.fileInstructions.values())
                    .filter(f => f.status === 'done' && f.instruction)
                    .sort((a, b) => a.fileName.localeCompare(b.fileName));

                if (filesSorted.length > 0) {
                    output += '## Файлы (детально)\n\n';
                    for (const fileInstr of filesSorted) {
                        output += `### 📄 ${fileInstr.fileName}\n\n`;
                        output += fileInstr.instruction + '\n\n';
                    }
                }

                output += '---\n\n';
            }
        }

        const blob = new Blob([output], { type: 'text/markdown; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project-instructions.md';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Clear all generated instructions.
     */
    clear() {
        this.instructions.set(new Map());
        this.progressStatus.set('');
        this.selectedItem.set(null);
        this.selectedFolder.set(null);
    }
}
