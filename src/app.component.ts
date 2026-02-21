import { Component } from '@angular/core';
import { AppShellComponent } from './features/app-shell';

/**
 * Root application component
 * Serves as the entry point and delegates rendering to AppShellComponent
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppShellComponent],
  template: '<app-shell></app-shell>',
})
export class AppComponent {}
