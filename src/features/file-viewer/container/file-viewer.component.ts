import {
  Component,
  inject,
  signal,
  computed,
  output,
  effect,
  untracked,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FileViewerService } from "../services/file-viewer.service";

declare const hljs: any;

/** A single selection range (line-based) */
interface SelectionRange {
  start: number;
  end: number;
}

@Component({
  selector: "app-file-viewer",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./file-viewer.component.html",
  styleUrl: "./file-viewer.component.css",
})
export class FileViewerComponent implements AfterViewChecked {
  public viewerService = inject(FileViewerService);

  @ViewChild("codeContainer") codeContainer!: ElementRef;

  /** Multiple selection ranges */
  selectionRanges = signal<SelectionRange[]>([]);

  /** Text selection snippets */
  textSelectionSnippets = signal<{ text: string; range: Range }[]>([]);

  /** Current drag selection (not yet committed) */
  dragStart = signal<number | null>(null);
  dragEnd = signal<number | null>(null);
  isSelecting = signal(false);

  /** Highlighted HTML lines */
  highlightedLines = signal<string[]>([]);

  /** Need to re-highlight after view update */
  private needsHighlight = false;

  /** All selected code snippets combined */
  allSelectedCode = computed(() => {
    const ranges = this.selectionRanges();
    const texts = this.textSelectionSnippets().map((t) => t.text);
    const lines = this.viewerService.fileLines();
    if (ranges.length === 0 && texts.length === 0) return "";

    const linesOutput = ranges.map((r) => {
      const from = Math.min(r.start, r.end);
      const to = Math.max(r.start, r.end);
      return lines.slice(from, to + 1).join("\n");
    });

    return [...linesOutput, ...texts].join("\n\n// ...\n\n");
  });

  /** Total selected lines count */
  totalSelectedLines = computed(() => {
    return this.selectionRanges().reduce((sum, r) => {
      return sum + Math.abs(r.end - r.start) + 1;
    }, 0);
  });

  /** Event to insert selected code into chat */
  insertToChat = output<string>();
  close = output<void>();

  constructor() {
    // Reset selection & highlight when file changes
    effect(() => {
      const content = this.viewerService.fileContent();
      const path = this.viewerService.currentFilePath();
      untracked(() => {
        this.clearSelection();
        this.highlightCode(content, path);
      });
    });
  }

  ngAfterViewChecked(): void {
    // No special logic needed currently
  }

  /**
   * Highlight code using highlight.js
   */
  private highlightCode(content: string, filePath: string): void {
    if (!content) {
      this.highlightedLines.set([]);
      return;
    }

    try {
      const ext = this.getExtFromPath(filePath);
      const lang = this.extToLang(ext);

      let result: string;
      if (typeof hljs !== "undefined") {
        if (lang && hljs.getLanguage(lang)) {
          result = hljs.highlight(content, { language: lang }).value;
        } else {
          result = hljs.highlightAuto(content).value;
        }
      } else {
        // Fallback: escape HTML
        result = content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }

      // Split highlighted HTML by newlines
      this.highlightedLines.set(result.split("\n"));
    } catch {
      // Fallback
      const escaped = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, ">");
      this.highlightedLines.set(escaped.split("\n"));
    }
  }

  /** Check if a line is in any selection range */
  isLineSelected(index: number): boolean {
    // Check committed ranges
    for (const r of this.selectionRanges()) {
      const from = Math.min(r.start, r.end);
      const to = Math.max(r.start, r.end);
      if (index >= from && index <= to) return true;
    }
    // Check current drag
    const ds = this.dragStart();
    const de = this.dragEnd();
    if (ds !== null && de !== null && this.isSelecting()) {
      const from = Math.min(ds, de);
      const to = Math.max(ds, de);
      if (index >= from && index <= to) return true;
    }
    return false;
  }

  /** Returns the index of the range that ends at this line, or -1 */
  getRangeEndingAt(lineIndex: number): number {
    const ranges = this.selectionRanges();
    for (let i = 0; i < ranges.length; i++) {
      const to = Math.max(ranges[i].start, ranges[i].end);
      if (to === lineIndex) return i;
    }
    return -1;
  }

  /** Mouse down on a line number — start selection */
  onLineMouseDown(index: number, event: MouseEvent): void {
    event.preventDefault();

    if (event.shiftKey) {
      // Shift+click: extend from last range end or add new range
      const ranges = this.selectionRanges();
      if (ranges.length > 0) {
        const lastRange = ranges[ranges.length - 1];
        // Add a new range from last range end to this line
        this.dragStart.set(lastRange.end);
        this.dragEnd.set(index);
      } else {
        this.dragStart.set(index);
        this.dragEnd.set(index);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+click: start adding a new independent range
      this.dragStart.set(index);
      this.dragEnd.set(index);
    } else {
      // Normal click: clear previous selections and start a new one
      this.clearSelection();
      this.dragStart.set(index);
      this.dragEnd.set(index);
    }
    this.isSelecting.set(true);
  }

  /** Mouse enters a line during drag */
  onLineMouseEnter(index: number): void {
    if (this.isSelecting()) {
      this.dragEnd.set(index);
    }
  }

  /** Mouse up — commit the drag selection */
  onMouseUp(): void {
    if (!this.isSelecting()) return;
    this.isSelecting.set(false);

    const ds = this.dragStart();
    const de = this.dragEnd();
    if (ds === null || de === null) return;

    const newRange: SelectionRange = {
      start: Math.min(ds, de),
      end: Math.max(ds, de),
    };

    this.selectionRanges.update((ranges) => [...ranges, newRange]);
    this.dragStart.set(null);
    this.dragEnd.set(null);
  }

  /** Handle native text selection for word-level selection */
  onTextSelect(event: MouseEvent): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text || selection.rangeCount === 0) return;

    // Capture the layout position before native selection vanishes
    const range = selection.getRangeAt(0).cloneRange();

    // Wait for mouseup to complete before adding selection
    setTimeout(() => {
      const existing = this.textSelectionSnippets();

      // Skip if exact substring of existing selection
      if (existing.some((s) => s.text === text || s.text.includes(text))) {
        selection.removeAllRanges();
        return;
      }

      // Check for overlapping/adjacent ranges — merge if found
      let mergeIndex = -1;
      for (let i = 0; i < existing.length; i++) {
        try {
          const s = existing[i];
          // Overlap: new range starts before existing ends AND new range ends after existing starts
          const startsBeforeEnd =
            range.compareBoundaryPoints(Range.START_TO_END, s.range) >= 0;
          const endsAfterStart =
            range.compareBoundaryPoints(Range.END_TO_START, s.range) <= 0;
          if (startsBeforeEnd && endsAfterStart) {
            mergeIndex = i;
            break;
          }
        } catch {
          // Different DOM containers — check text overlap as fallback
          if (text.includes(existing[i].text)) {
            mergeIndex = i;
            break;
          }
        }
      }

      if (mergeIndex >= 0) {
        // Merge: create a new range that encompasses both
        const existingRange = existing[mergeIndex].range;
        const mergedRange = document.createRange();

        // Take the earliest start
        if (
          range.compareBoundaryPoints(Range.START_TO_START, existingRange) < 0
        ) {
          mergedRange.setStart(range.startContainer, range.startOffset);
        } else {
          mergedRange.setStart(
            existingRange.startContainer,
            existingRange.startOffset,
          );
        }

        // Take the latest end
        if (range.compareBoundaryPoints(Range.END_TO_END, existingRange) > 0) {
          mergedRange.setEnd(range.endContainer, range.endOffset);
        } else {
          mergedRange.setEnd(
            existingRange.endContainer,
            existingRange.endOffset,
          );
        }

        const mergedText = mergedRange.toString().trim();

        this.textSelectionSnippets.update((snippets) =>
          snippets.map((s, i) =>
            i === mergeIndex ? { text: mergedText, range: mergedRange } : s,
          ),
        );
      } else {
        // No overlap — add as new snippet
        this.textSelectionSnippets.update((snippets) => [
          ...snippets,
          { text, range },
        ]);
      }

      this.updateHighlights();

      // Clear native selection since we now paint it with CSS Custom Highlights API
      selection.removeAllRanges();
    }, 10);
  }

  updateHighlights() {
    const cssObj = (window as any).CSS;
    if (typeof cssObj !== "undefined" && "highlights" in cssObj) {
      const ranges = this.textSelectionSnippets().map((s) => s.range);
      try {
        if (ranges.length > 0) {
          const highlight = new (window as any).Highlight(...ranges);
          cssObj.highlights.set("user-selection", highlight);
        } else {
          cssObj.highlights.delete("user-selection");
        }
      } catch (e) {
        console.error("Highlight API error", e);
      }
    }
  }

  clearSelection(): void {
    this.selectionRanges.set([]);
    this.textSelectionSnippets.set([]);
    this.dragStart.set(null);
    this.dragEnd.set(null);
    this.isSelecting.set(false);
    this.updateHighlights();
    window.getSelection()?.removeAllRanges();
  }

  removeRange(index: number): void {
    this.selectionRanges.update((ranges) =>
      ranges.filter((_, i) => i !== index),
    );
  }

  removeTextSnippet(index: number): void {
    this.textSelectionSnippets.update((snippets) =>
      snippets.filter((_, i) => i !== index),
    );
    this.updateHighlights();
  }

  /** Insert a single line range into chat and remove it from selection */
  insertSingleRange(index: number): void {
    const ranges = this.selectionRanges();
    const lines = this.viewerService.fileLines();
    const path = this.viewerService.currentFilePath();
    if (index >= ranges.length) return;

    const r = ranges[index];
    const from = Math.min(r.start, r.end);
    const to = Math.max(r.start, r.end);
    const code = lines.slice(from, to + 1).join("\n");
    const snippet = `\`\`\`\n// File: ${path}\n// Lines ${from + 1}-${to + 1}\n${code}\n\`\`\``;
    this.insertToChat.emit(snippet);
    this.removeRange(index);
  }

  /** Insert a single text snippet into chat and remove it from selection */
  insertSingleText(index: number): void {
    const texts = this.textSelectionSnippets();
    const path = this.viewerService.currentFilePath();
    if (index >= texts.length) return;

    const snippet = `\`\`\`\n// File: ${path}\n${texts[index].text}\n\`\`\``;
    this.insertToChat.emit(snippet);
    this.removeTextSnippet(index);
  }

  onInsertToChat(): void {
    const ranges = this.selectionRanges();
    const texts = this.textSelectionSnippets().map((t) => t.text);
    const lines = this.viewerService.fileLines();
    const path = this.viewerService.currentFilePath();

    if (ranges.length === 0 && texts.length === 0) return;

    const snippets: string[] = [];

    // Check for native text selection (word-level) not yet captured (if any)
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const currentSelectionText = selection.toString().trim();
      if (currentSelectionText) {
        snippets.push(`// Text selection\n${currentSelectionText}`);
        selection.removeAllRanges();
      }
    }

    // Add line-based selection
    if (lines.length > 0) {
      for (const r of ranges) {
        const from = Math.min(r.start, r.end);
        const to = Math.max(r.start, r.end);
        const code = lines.slice(from, to + 1).join("\n");
        snippets.push(`// Lines ${from + 1}-${to + 1}\n${code}`);
      }
    }

    // Add native text snippets
    for (const text of texts) {
      snippets.push(`// Text selection\n${text}`);
    }

    const combined = snippets.join("\n\n// ...\n\n");
    const finalSnippet = `\`\`\`\n// File: ${path}\n${combined}\n\`\`\``;

    this.insertToChat.emit(finalSnippet);
    this.clearSelection();
  }

  getFileExtension(): string {
    return this.getExtFromPath(this.viewerService.currentFilePath());
  }

  getFileName(): string {
    const path = this.viewerService.currentFilePath();
    if (!path) return "";
    const parts = path.split("/");
    return parts[parts.length - 1];
  }

  /** Get range display text */
  getRangeLabel(range: SelectionRange): string {
    const from = Math.min(range.start, range.end) + 1;
    const to = Math.max(range.start, range.end) + 1;
    return from === to ? `Line ${from}` : `Lines ${from}-${to}`;
  }

  private getExtFromPath(path: string): string {
    if (!path) return "";
    const parts = path.split(".");
    return parts.length > 1 ? parts[parts.length - 1] : "";
  }

  private extToLang(ext: string): string {
    const map: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      css: "css",
      scss: "css",
      html: "xml",
      xml: "xml",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      sh: "bash",
      bash: "bash",
      sql: "sql",
      md: "markdown",
      dockerfile: "dockerfile",
    };
    return map[ext.toLowerCase()] || ext.toLowerCase();
  }
}
