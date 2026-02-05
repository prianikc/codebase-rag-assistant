import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileExplorerComponent } from './components/file-explorer.component';
import { ChatInterfaceComponent } from './components/chat-interface.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FileExplorerComponent, ChatInterfaceComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {}