import { Component, inject, computed, signal, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  KnowledgeBaseService,
  VectorStoreService,
} from "../../../shared/services";
import { ChatHistoryService } from "../../chat/services";
import { ConfirmationModalComponent } from "../../../shared/components/confirmation-modal/confirmation-modal.component";
import { FileNode } from "../../../core/models";
import { FileViewerService } from "../../file-viewer";

@Component({
  selector: "app-sidebar-container",
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: "./sidebar.container.component.html",
  styleUrl: "./sidebar.container.component.css",
})
export class SidebarContainerComponent {
  public kbService = inject(KnowledgeBaseService);
  public vectorStore = inject(VectorStoreService);
  public chatService = inject(ChatHistoryService);
  public fileViewerService = inject(FileViewerService);

  activeTab = signal<"files" | "chats">("files");

  showRepoInput = false;
  repoUrl = "";

  showConfirmModal = signal(false);
  confirmTitle = signal("");
  confirmMessage = signal("");

  private pendingAction: "repo" | "clear" | "delete_session" | null = null;
  private pendingSessionId: string | null = null;

  treeNodes = computed(() => {
    const paths = this.kbService.filePaths();
    return this.buildTree(paths);
  });

  openFolders = signal<Set<string>>(new Set());

  openInstructions = output<void>();

  toggleRepoInput(): void {
    this.showRepoInput = !this.showRepoInput;
  }

  onFilesSelected(event: Event, input: HTMLInputElement): void {
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.kbService.ingestFiles(files);
      input.value = "";
    }
  }

  prepareRepoLoad(): void {
    if (!this.repoUrl.trim()) return;
    this.pendingAction = "repo";
    this.confirmTitle.set("Ingest Repository");
    this.confirmMessage.set(
      `Download and index contents from ${this.repoUrl}? This will overwrite the current vector database.`,
    );
    this.showConfirmModal.set(true);
  }

  confirmClearVectors(): void {
    this.pendingAction = "clear";
    this.confirmTitle.set("Clear Database");
    this.confirmMessage.set(
      "Are you sure you want to delete all indexed code vectors? This action cannot be undone.",
    );
    this.showConfirmModal.set(true);
  }

  onConfirmAction(): void {
    this.showConfirmModal.set(false);

    if (this.pendingAction === "repo" && this.repoUrl) {
      this.kbService.ingestGitHubRepo(this.repoUrl.trim());
    } else if (this.pendingAction === "clear") {
      this.vectorStore.clear();
    } else if (
      this.pendingAction === "delete_session" &&
      this.pendingSessionId
    ) {
      this.chatService.deleteSession(this.pendingSessionId);
    }

    this.pendingAction = null;
    this.pendingSessionId = null;
  }

  onCancelAction(): void {
    this.showConfirmModal.set(false);
    this.pendingAction = null;
    this.pendingSessionId = null;
  }

  deleteSession(id: string): void {
    this.pendingAction = "delete_session";
    this.pendingSessionId = id;

    this.confirmTitle.set("Delete Chat Session");
    this.confirmMessage.set(
      "Are you sure you want to delete this chat history? This cannot be undone.",
    );
    this.showConfirmModal.set(true);
  }

  toggleNode(node: FileNode): void {
    if (node.type === "folder") {
      const current = new Set(this.openFolders());
      if (current.has(node.path)) {
        current.delete(node.path);
      } else {
        current.add(node.path);
      }
      this.openFolders.set(current);
    } else if (node.type === "file") {
      this.fileViewerService.openFile(node.path);
    }
  }

  expandAll(): void {
    const allPaths = new Set<string>();
    const paths = this.kbService.filePaths();
    paths.forEach((p) => {
      const parts = p.split("/");
      let current = "";
      for (let i = 0; i < parts.length - 1; i++) {
        current += (current ? "/" : "") + parts[i];
        allPaths.add(current);
      }
    });
    this.openFolders.set(allPaths);
  }

  collapseAll(): void {
    this.openFolders.set(new Set());
  }

  private buildTree(paths: string[]): FileNode[] {
    const root: FileNode[] = [];
    const openSet = this.openFolders();
    const sortedPaths = [...paths].sort();

    for (const path of sortedPaths) {
      const parts = path.split("/");
      let currentLevel = root;
      let currentPath = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        currentPath += (currentPath ? "/" : "") + part;

        let node = currentLevel.find((n) => n.name === part);

        if (!node) {
          node = {
            name: part,
            path: currentPath,
            type: isFile ? "file" : "folder",
            children: [],
            isOpen: openSet.has(currentPath),
            level: i,
          };
          currentLevel.push(node);

          currentLevel.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === "folder" ? -1 : 1;
          });
        }
        currentLevel = node.children;
      }
    }
    return root;
  }
}
