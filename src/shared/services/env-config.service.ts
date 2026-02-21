import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class EnvConfigService {

    constructor() { }

    /**
     * Retrieves the API Key from the environment variables.
     * It checks both Node.js process.env and browser window.process.env.
     */
    getApiKey(): string {
        // 1. Check Node.js process.env (for SSR or local dev tools)
        if (typeof process !== 'undefined' && process.env && process.env['API_KEY']) {
            return process.env['API_KEY'];
        }

        // 2. Check Browser window.process.env (polyfilled in main.tsx)
        const win = (typeof window !== 'undefined') ? window as any : undefined;
        if (win && win.process && win.process.env && win.process.env.API_KEY) {
            return win.process.env.API_KEY;
        }

        return '';
    }
}
