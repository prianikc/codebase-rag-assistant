import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
    name: 'markdown',
    standalone: true
})
export class MarkdownPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) { }

    transform(value: string): SafeHtml {
        if (!value) return '';

        // Pre-process: detect raw error JSON patterns and format them
        value = this.formatRawErrors(value);

        const win = window as any;
        const marked = win.marked;
        const hljs = win.hljs;

        if (!marked) {
            console.warn('Marked.js not loaded');
            // Fallback: basic formatting without marked
            return this.sanitizer.bypassSecurityTrustHtml(this.basicFormat(value));
        }

        const renderer = new marked.Renderer();

        // Code block — marked v4 passes (code, language, ...)
        renderer.code = (codeOrObj: any, language?: string) => {
            let code: string;
            let lang: string;

            // Handle both v4 (code, lang) and v5+ ({text, lang}) signatures
            if (typeof codeOrObj === 'object' && codeOrObj !== null) {
                code = codeOrObj.text || codeOrObj.raw || '';
                lang = codeOrObj.lang || '';
            } else {
                code = codeOrObj || '';
                lang = language || '';
            }

            const validLang = lang ? lang.split(' ')[0] : '';
            let highlighted = this.escapeHtml(code);

            if (hljs) {
                try {
                    if (validLang && hljs.getLanguage(validLang)) {
                        highlighted = hljs.highlight(code, { language: validLang }).value;
                    } else {
                        highlighted = hljs.highlightAuto(code).value;
                    }
                } catch (e) {
                    // keep escaped version
                }
            }

            const langLabel = validLang || 'code';
            return `<pre style="margin:1rem 0;border-radius:12px;background:#0a0e1a;border:1px solid rgba(56,72,110,0.35);overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(56,72,110,0.35);font-size:10px;font-family:'JetBrains Mono',monospace;color:#5a677d;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
          <span>${langLabel}</span>
          <button onclick="navigator.clipboard.writeText(this.closest('pre').querySelector('code').innerText).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})" style="background:transparent;border:1px solid rgba(56,72,110,0.35);color:#5a677d;padding:2px 8px;border-radius:4px;font-size:9px;cursor:pointer;font-family:inherit;transition:color 0.2s;">Copy</button>
        </div>
        <code class="hljs language-${validLang}" style="display:block;padding:16px;font-size:13px;font-family:'JetBrains Mono',monospace;color:#e8ecf4;background:transparent;overflow-x:auto;line-height:1.6;">${highlighted}</code>
      </pre>`;
        };

        // Inline code
        renderer.codespan = (textOrObj: any) => {
            const text = typeof textOrObj === 'object' ? (textOrObj.text || textOrObj.raw || '') : textOrObj;
            return `<code style="background:#141b2d;color:#06b6d4;padding:2px 6px;border-radius:4px;border:1px solid rgba(56,72,110,0.35);font-family:'JetBrains Mono',monospace;font-size:12px;">${text}</code>`;
        };

        // Links
        renderer.link = (hrefOrObj: any, title?: string | null, text?: string) => {
            let href: string, linkText: string, linkTitle: string;
            if (typeof hrefOrObj === 'object' && hrefOrObj !== null) {
                href = hrefOrObj.href || '';
                linkText = hrefOrObj.text || '';
                linkTitle = hrefOrObj.title || '';
            } else {
                href = hrefOrObj || '';
                linkText = text || '';
                linkTitle = title || '';
            }
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#6366f1;text-decoration:none;font-weight:500;border-bottom:1px solid rgba(99,102,241,0.3);transition:border-color 0.2s;" onmouseover="this.style.borderBottomColor='#6366f1'" onmouseout="this.style.borderBottomColor='rgba(99,102,241,0.3)'" title="${linkTitle}">${linkText}</a>`;
        };

        try {
            const result = marked.parse(value, {
                renderer: renderer,
                breaks: true,
                gfm: true,
                async: false
            });

            // Handle both sync and async returns
            if (typeof result === 'string') {
                return this.sanitizer.bypassSecurityTrustHtml(result);
            }
            // If marked returns a promise (shouldn't with async:false, but just in case)
            return this.sanitizer.bypassSecurityTrustHtml(this.basicFormat(value));
        } catch (e) {
            console.error('Markdown parsing error:', e);
            return this.sanitizer.bypassSecurityTrustHtml(this.basicFormat(value));
        }
    }

    private basicFormat(text: string): string {
        // Simple fallback: convert newlines to <br>, escape HTML
        return this.escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/`([^`]+)`/g, '<code style="background:#141b2d;color:#06b6d4;padding:2px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:12px;">$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private formatRawErrors(text: string): string {
        // Match [ERROR: ...] pattern (with possible JSON inside)
        text = text.replace(/\[ERROR:\s*([\s\S]*?)\]\s*$/gm, (_match, errorContent) => {
            const cleanMsg = this.extractCleanError(errorContent.trim());
            return `\n\n---\n\n> ⚠️ **Error**\n>\n> ${cleanMsg}\n\n*Check your API key, model, and endpoint in Settings.*`;
        });

        // Match System Error: ... pattern
        text = text.replace(/^System Error:\s*(.*)/gm, (_match, msg) => {
            return `> ❌ **System Error**\n>\n> ${msg.trim()}`;
        });

        return text;
    }

    private extractCleanError(raw: string): string {
        // Try to parse as JSON and extract .error.message
        try {
            const parsed = JSON.parse(raw);
            if (parsed.error?.message) return parsed.error.message;
            if (parsed.message) return parsed.message;
            if (typeof parsed.error === 'string') return parsed.error;
        } catch (_e) {
            // not JSON
        }

        // Try to find JSON inside the string
        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.error?.message) return parsed.error.message;
                if (parsed.message) return parsed.message;
            }
        } catch (_e) {
            // not parseable
        }

        // Fallback: return truncated raw text
        return raw.length > 200 ? raw.substring(0, 200) + '...' : raw;
    }
}
