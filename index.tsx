import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './src/app.component';
import { provideZonelessChangeDetection } from '@angular/core';
import './src/styles.css'; // Import global styles here

// FIX: Polyfill 'process' safely.
// We check if it exists first to avoid overwriting real env vars if injected by a build system.
const win = window as any;
win.process = win.process || {};
win.process.env = win.process.env || {};
// If API_KEY is not defined, we leave it undefined or empty string.
// The LlmService will handle the missing key gracefully.
if (!win.process.env.API_KEY) {
  win.process.env.API_KEY = '';
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection()
  ]
}).catch((err) => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.
