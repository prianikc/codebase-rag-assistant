import { Component, inject, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectInstructionsService, FolderInstruction, FileInstruction } from '../services';
import { VectorStoreService } from '../../../shared/services';
import { MarkdownPipe } from '../../../shared/pipes';

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children: TreeNode[];
  isOpen: boolean;
  level: number;
  folderInstruction?: FolderInstruction;
  fileInstruction?: FileInstruction;
}

@Component({
  selector: 'app-project-instructions-container',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
  templateUrl: './project-instructions.container.component.html',
  styleUrl: './project-instructions.container.component.css',
})
export class ProjectInstructionsContainerComponent {
  public instructionsService = inject(ProjectInstructionsService);
  public vectorStore = inject(VectorStoreService);

  closeModal = output<void>();

  openFolders = signal<Set<string>>(new Set(['']));

  /** Currently selected item (folder or file) */
  selectedType = signal<'folder' | 'file'>('folder');
  selectedPath = signal<string | null>(null);

  selectedContent = computed(() => {
    const path = this.selectedPath();
    if (!path) return null;

    if (this.selectedType() === 'folder') {
      return this.instructionsService.instructions().get(path) || null;
    } else {
      // Find file instruction across all folders
      for (const fi of this.instructionsService.instructions().values()) {
        const fileInstr = fi.fileInstructions.get(path);
        if (fileInstr) return fileInstr;
      }
      return null;
    }
  });

  treeNodes = computed(() => {
    const map = this.instructionsService.instructions();
    if (map.size === 0) return [];
    return this.buildTree(Array.from(map.values()));
  });

  hasFiles = computed(() => this.vectorStore.docCount() > 0);

  onClose(): void {
    this.closeModal.emit();
  }

  generate(): void {
    this.instructionsService.generateAll();
  }

  selectItem(path: string, type: 'folder' | 'file'): void {
    this.selectedPath.set(path);
    this.selectedType.set(type);
  }

  regenerateSelected(): void {
    const path = this.selectedPath();
    if (!path) return;

    if (this.selectedType() === 'folder') {
      this.instructionsService.regenerateFolder(path);
    } else {
      this.instructionsService.regenerateFile(path);
    }
  }

  exportAll(): void {
    this.instructionsService.exportAll();
  }

  toggleNode(node: TreeNode): void {
    const current = new Set(this.openFolders());
    if (current.has(node.path)) {
      current.delete(node.path);
    } else {
      current.add(node.path);
    }
    this.openFolders.set(current);
  }

  isOpen(path: string): boolean {
    return this.openFolders().has(path);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'done':
        return '✅';
      case 'generating':
        return '⏳';
      case 'error':
        return '❌';
      default:
        return '⬜';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'done':
        return 'status--done';
      case 'generating':
        return 'status--generating';
      case 'error':
        return 'status--error';
      default:
        return 'status--pending';
    }
  }

  isFolderInstruction(item: unknown): item is FolderInstruction {
    return typeof item === 'object' && item !== null && 'folderPath' in item;
  }

  isFileInstruction(item: unknown): item is FileInstruction {
    return typeof item === 'object' && item !== null && 'filePath' in item;
  }

  private buildTree(instructions: FolderInstruction[]): TreeNode[] {
    const root: TreeNode[] = [];
    const openSet = this.openFolders();

    const sortedInstructions = [...instructions].sort((a, b) =>
      a.folderPath.localeCompare(b.folderPath)
    );

    for (const fi of sortedInstructions) {
      const parts = fi.folderPath.split('/');
      let currentLevel = root;
      let currentPath = '';

      // Build folder hierarchy
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath += (currentPath ? '/' : '') + part;

        let node = currentLevel.find((n) => n.name === part && n.type === 'folder');

        if (!node) {
          node = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
            isOpen: openSet.has(currentPath),
            level: i,
            folderInstruction: currentPath === fi.folderPath ? fi : undefined,
          };
          currentLevel.push(node);
        } else if (currentPath === fi.folderPath) {
          node.folderInstruction = fi;
        }

        currentLevel = node.children;
      }

      // Add file nodes under the folder
      const filesSorted = Array.from(fi.fileInstructions.values()).sort((a, b) =>
        a.fileName.localeCompare(b.fileName)
      );

      for (const fileInstr of filesSorted) {
        const fileNode: TreeNode = {
          name: fileInstr.fileName,
          path: fileInstr.filePath,
          type: 'file',
          children: [],
          isOpen: false,
          level: parts.length,
          fileInstruction: fileInstr,
        };
        currentLevel.push(fileNode);
      }

      // Sort: folders first, then files
      currentLevel.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      });
    }

    return root;
  }
}
