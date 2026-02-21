import {
  Component,
  inject,
  signal,
  WritableSignal,
  HostListener,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FileDropService } from "../services";
import { SidebarContainerComponent } from "../../sidebar";
import { ChatContainerComponent } from "../../chat";
import { ProjectInstructionsContainerComponent } from "../../project-instructions";
import { FileViewerComponent, FileViewerService } from "../../file-viewer";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    CommonModule,
    SidebarContainerComponent,
    ChatContainerComponent,
    ProjectInstructionsContainerComponent,
    FileViewerComponent,
  ],
  templateUrl: "./app-shell.component.html",
  styleUrl: "./app-shell.component.css",
})
export class AppShellComponent {
  private readonly fileDropService = inject(FileDropService);
  readonly fileViewerService = inject(FileViewerService);

  readonly isDragging = this.fileDropService.isDragging;
  readonly showInstructions: WritableSignal<boolean> = signal(false);

  /** Handle code snippet insertion from file viewer to chat */
  pendingSnippet = signal<string>("");

  /** Panel widths */
  sidebarWidth = signal(280);
  viewerWidth = signal(500);

  /** Resize state */
  private resizing: "sidebar" | "viewer" | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  onDragOver(event: DragEvent): void {
    this.fileDropService.handleDragOver(event);
  }

  onDragLeave(event: DragEvent): void {
    this.fileDropService.handleDragLeave(event);
  }

  onDrop(event: DragEvent): void {
    this.fileDropService.handleDrop(event);
  }

  /** Start resizing sidebar */
  onResizeSidebarStart(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = "sidebar";
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.sidebarWidth();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  /** Start resizing viewer */
  onResizeViewerStart(event: MouseEvent): void {
    event.preventDefault();
    this.resizing = "viewer";
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.viewerWidth();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  @HostListener("document:mousemove", ["$event"])
  onMouseMove(event: MouseEvent): void {
    if (!this.resizing) return;

    const delta = event.clientX - this.resizeStartX;

    if (this.resizing === "sidebar") {
      const newWidth = Math.max(
        200,
        Math.min(500, this.resizeStartWidth + delta),
      );
      this.sidebarWidth.set(newWidth);
    } else if (this.resizing === "viewer") {
      const newWidth = Math.max(
        280,
        Math.min(900, this.resizeStartWidth + delta),
      );
      this.viewerWidth.set(newWidth);
    }
  }

  @HostListener("document:mouseup")
  onMouseUp(): void {
    if (this.resizing) {
      this.resizing = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }
}
