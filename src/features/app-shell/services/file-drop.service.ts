import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { KnowledgeBaseService } from '../../../shared/services';

/** Extended DataTransferItem with webkit filesystem API */
interface WebkitDataTransferItem extends DataTransferItem {
  webkitGetAsEntry(): FileSystemEntry | null;
}

/** Type guard for webkit filesystem API support */
function hasWebkitApi(item: DataTransferItem): item is WebkitDataTransferItem {
  return 'webkitGetAsEntry' in item && typeof (item as WebkitDataTransferItem).webkitGetAsEntry === 'function';
}

/**
 * Service for handling file drag-and-drop operations
 * with support for both files and directories
 */
@Injectable({
  providedIn: 'root',
})
export class FileDropService {
  private readonly kbService = inject(KnowledgeBaseService);

  /** Whether user is currently dragging files over the app */
  readonly isDragging: WritableSignal<boolean> = signal(false);

  // ─── Drag Event Handlers ───

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  async handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const items = event.dataTransfer?.items;
    if (!items?.length) return;

    const files = await this.extractFilesFromDataTransfer(items);

    if (files.length > 0) {
      this.kbService.ingestFiles(files);
    }
  }

  // ─── File Extraction ───

  private async extractFilesFromDataTransfer(items: DataTransferItemList): Promise<File[]> {
    const files: File[] = [];
    const itemArray = Array.from(items);

    await Promise.all(
      itemArray
        .filter((item) => item.kind === 'file')
        .map((item) => this.processDataTransferItem(item, files))
    );

    return files;
  }

  private async processDataTransferItem(item: DataTransferItem, files: File[]): Promise<void> {
    if (hasWebkitApi(item)) {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        await this.readEntryRecursive(entry, files);
        return;
      }
    }

    // Fallback: get file directly if filesystem API not available
    const file = item.getAsFile();
    if (file) {
      files.push(file);
    }
  }

  // ─── FileSystem API Traversal ───

  private async readEntryRecursive(entry: FileSystemEntry, files: File[]): Promise<void> {
    if (entry.isFile) {
      await this.processFileEntry(entry as FileSystemFileEntry, files);
    } else if (entry.isDirectory) {
      await this.processDirectoryEntry(entry as FileSystemDirectoryEntry, files);
    }
  }

  private processFileEntry(fileEntry: FileSystemFileEntry, files: File[]): Promise<void> {
    return new Promise((resolve, reject) => {
      fileEntry.file(
        (file) => {
          Object.defineProperty(file, 'webkitRelativePath', {
            value: fileEntry.fullPath.replace(/^\//, ''),
            writable: false,
            enumerable: true,
            configurable: false,
          });
          files.push(file);
          resolve();
        },
        (error) => reject(this.createFileReadError(fileEntry.fullPath, error))
      );
    });
  }

  private async processDirectoryEntry(dirEntry: FileSystemDirectoryEntry, files: File[]): Promise<void> {
    const reader = dirEntry.createReader();

    let entries: FileSystemEntry[];
    do {
      entries = await this.readDirectoryBatch(reader);
      await Promise.all(entries.map((entry) => this.readEntryRecursive(entry, files)));
    } while (entries.length > 0);
  }

  private readDirectoryBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    return new Promise((resolve, reject) => {
      reader.readEntries(
        (entries) => resolve(entries),
        (error) => reject(this.createDirectoryReadError(error))
      );
    });
  }

  // ─── Error Handling ───

  private createFileReadError(path: string, originalError?: DOMException | null): Error {
    return new Error(`Failed to read file "${path}": ${originalError?.message ?? 'Unknown error'}`);
  }

  private createDirectoryReadError(originalError?: DOMException | null): Error {
    return new Error(`Failed to read directory: ${originalError?.message ?? 'Unknown error'}`);
  }
}
