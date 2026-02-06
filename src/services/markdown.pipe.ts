import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Access the global hljs object loaded via script tag in index.html
declare const hljs: any;

@Pipe({
  name: 'markdown',
  standalone: true
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';

    const codeBlocks = new Map<string, string>();
    let blockId = 0;

    // 1. Extract Code Blocks (```lang ... ```)
    // Regex improvements:
    // - ([\w\-\.\+]+) matches lang names like 'c++', 'c#', 'python-repl'
    // - (?:\s+)? handles optional whitespace/newline after lang
    // - ([\s\S]*?) matches content lazily
    let html = value.replace(/```([\w\-\.\+]+)?\s*([\s\S]*?)```/g, (match, lang, code) => {
      const cleanCode = code ? code.trim() : ''; 
      const id = `###CODE_BLOCK_${blockId++}###`;
      
      let highlighted = '';
      let languageLabel = lang || '';

      if (typeof hljs !== 'undefined') {
        try {
          if (lang && hljs.getLanguage(lang)) {
            // Precise language
            highlighted = hljs.highlight(cleanCode, { language: lang }).value;
          } else if (lang && (lang === 'ts' || lang === 'tsx')) {
             // Manual alias fix if needed (though hljs usually has these)
             highlighted = hljs.highlight(cleanCode, { language: 'typescript' }).value;
             languageLabel = 'typescript';
          } else if (lang && (lang === 'js' || lang === 'jsx')) {
             highlighted = hljs.highlight(cleanCode, { language: 'javascript' }).value;
             languageLabel = 'javascript';
          } else {
             // Auto detect
             const result = hljs.highlightAuto(cleanCode);
             highlighted = result.value;
             if (!languageLabel && result.language) {
               languageLabel = result.language;
             }
          }
        } catch (e) {
          // Fallback
          highlighted = this.escapeHtml(cleanCode);
        }
      } else {
        highlighted = this.escapeHtml(cleanCode);
      }

      // WebStorm-like Container (Darcula)
      const langHeader = languageLabel 
        ? `<div class="px-4 py-1.5 bg-[#3c3f41] text-[#a9b7c6] text-xs font-mono font-bold border-b border-[#555] uppercase select-none flex items-center gap-2">
             <span class="w-2 h-2 rounded-full bg-[#ff5f56]"></span>
             ${languageLabel}
           </div>` 
        : `<div class="px-4 py-1.5 bg-[#3c3f41] border-b border-[#555] flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-[#ff5f56]"></span></div>`;

      const codeHtml = `
        <div class="my-4 rounded-lg overflow-hidden border border-[#555] bg-[#2b2b2b] shadow-xl group">
          ${langHeader}
          <div class="relative">
             <pre class="p-4 m-0 overflow-x-auto custom-scrollbar"><code class="hljs text-[13px] leading-relaxed bg-transparent !p-0 block" style="font-family: 'JetBrains Mono', monospace;">${highlighted}</code></pre>
          </div>
        </div>`;
      
      codeBlocks.set(id, codeHtml);
      return id;
    });

    // 2. Extract Inline Code (`...`)
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      const id = `###INLINE_CODE_${blockId++}###`;
      const codeHtml = `<code class="bg-[#3c3f41] px-1.5 py-0.5 rounded text-[#a9b7c6] border border-[#555] text-xs shadow-sm" style="font-family: 'JetBrains Mono', monospace;">${this.escapeHtml(code)}</code>`;
      codeBlocks.set(id, codeHtml);
      return id;
    });

    // 3. Escape HTML in the remaining narrative
    html = this.escapeHtml(html);

    // 4. Markdown Formatting
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#cc7832] font-bold tracking-wide">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="text-[#808080]">$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-[#589df6] hover:text-[#7caeea] hover:underline transition-colors">$1</a>');
    html = html.replace(/^\s*-\s+(.*)$/gm, '<li class="ml-4 list-disc marker:text-slate-500 text-slate-300">$1</li>');
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-[#e8eaed] mt-6 mb-3 flex items-center gap-2"><span class="text-[#cc7832]">#</span> $1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-[#e8eaed] mt-8 mb-4 border-b border-[#555] pb-2 flex items-center gap-2"><span class="text-[#cc7832]">##</span> $1</h2>');

    // Newlines
    html = html.replace(/\n/g, '<br>');

    // 5. Restore Code Blocks
    codeBlocks.forEach((val, key) => {
      html = html.split(key).join(val);
    });

    return this.sanitizer.bypassSecurityTrustHtml(html);
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
