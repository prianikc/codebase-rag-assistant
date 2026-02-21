import { Injectable, signal, computed, inject } from "@angular/core";
import { VectorStoreService } from "../../../shared/services";

/**
 * Service responsible for loading and exposing file content
 * for the File Viewer panel.
 *
 * It pulls file content from the already-indexed VectorStore documents,
 * reassembling chunks into the full file text.
 */
@Injectable({ providedIn: "root" })
export class FileViewerService {
  private vectorStore = inject(VectorStoreService);

  /** Path of the currently opened file */
  currentFilePath = signal<string>("");

  /** Whether the viewer panel is open */
  isOpen = signal(false);

  /** Loading state */
  isLoading = signal(false);

  /** Raw file content as a string */
  fileContent = signal<string>("");

  /** Lines of the current file */
  fileLines = computed(() => {
    const content = this.fileContent();
    if (!content) return [];
    return content.split("\n");
  });

  /**
   * Open a file in the viewer.
   * Reconstructs file content from VectorStore chunks.
   */
  openFile(filePath: string): void {
    if (this.currentFilePath() === filePath && this.isOpen()) {
      // Already showing this file
      return;
    }

    this.isLoading.set(true);
    this.currentFilePath.set(filePath);
    this.isOpen.set(true);

    // Reconstruct file content from vector store chunks
    const docs = this.vectorStore.getAllDocuments();
    const fileChunks = docs
      .filter((d) => d.filePath === filePath)
      .sort((a, b) => {
        const aStart = (a.metadata?.["start"] as number) ?? 0;
        const bStart = (b.metadata?.["start"] as number) ?? 0;
        return aStart - bStart;
      });

    if (fileChunks.length === 0) {
      this.fileContent.set("");
      this.isLoading.set(false);
      return;
    }

    // The chunks overlap, so we need to merge them carefully
    let reconstructed = "";
    let lastEnd = 0;

    for (const chunk of fileChunks) {
      const chunkStart = (chunk.metadata?.["start"] as number) ?? 0;
      const chunkEnd =
        (chunk.metadata?.["end"] as number) ??
        chunkStart + chunk.content.length;

      if (chunkStart <= lastEnd && reconstructed.length > 0) {
        // Overlap — append only the new part
        const overlapAmount = lastEnd - chunkStart;
        if (overlapAmount < chunk.content.length) {
          reconstructed += chunk.content.substring(overlapAmount);
        }
      } else {
        // No overlap or first chunk
        reconstructed += chunk.content;
      }
      lastEnd = Math.max(lastEnd, chunkEnd);
    }

    this.fileContent.set(reconstructed);
    this.isLoading.set(false);
  }

  /** Close the viewer */
  closeViewer(): void {
    this.isOpen.set(false);
    this.currentFilePath.set("");
    this.fileContent.set("");
  }
}
