import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';

    const win = window as any;
    const marked = win.marked;
    const hljs = win.hljs;

    if (!marked) {
      console.warn('Marked.js not loaded');
      return value;
    }

    // Configure renderer
    const renderer = new marked.Renderer();

    // 1. Code Blocks: Simple standard wrapper
    renderer.code = (code: string, language: string | undefined) => {
      const validLang = language ? language.split(' ')[0] : '';
      let highlighted = code;

      if (hljs) {
        try {
          if (validLang && hljs.getLanguage(validLang)) {
            highlighted = hljs.highlight(code, { language: validLang }).value;
          } else {
            highlighted = hljs.highlightAuto(code).value;
          }
        } catch (e) {
          highlighted = this.escapeHtml(code);
        }
      }

      // Standard HTML structure for code blocks
      const langClass = validLang ? `language-${validLang}` : '';
      return `<pre class="my-4 p-4 rounded-lg bg-[#1e1e1e] border border-slate-700 overflow-x-auto"><code class="hljs ${langClass} text-sm font-mono text-slate-300 bg-transparent p-0 block">${highlighted}</code></pre>`;
    };

    // 2. Inline Code
    renderer.codespan = (text: string) => {
      return `<code class="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded border border-slate-600 font-mono text-xs">${text}</code>`;
    };

    // 3. Links (Open in new tab)
    renderer.link = (href: string, title: string, text: string) => {
      return `<a href="${href}" target="_blank" class="text-blue-400 hover:text-blue-300 hover:underline" title="${title || ''}">${text}</a>`;
    };

    try {
      const html = marked.parse(value, {
        renderer: renderer,
        breaks: true,
        gfm: true
      });
      return this.sanitizer.bypassSecurityTrustHtml(html);
    } catch (e) {
      console.error('Markdown parsing error:', e);
      return value;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}