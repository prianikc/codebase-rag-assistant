/**
 * Extract a clean, human-readable error message from any error type.
 * Handles Error objects, API JSON responses, Gemini SDK errors, and plain strings.
 */
export function extractErrorMessage(error: unknown): string {
    if (!error) return 'Unknown error';

    // String error
    if (typeof error === 'string') return error;

    const err = error as Record<string, unknown>;

    // Standard Error object
    if (err['message'] && typeof err['message'] === 'string') {
        let msg = err['message'] as string;

        // Try to parse JSON inside the message (common with API errors)
        try {
            const jsonMatch = msg.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.error?.message) return parsed.error.message;
                if (parsed.message) return parsed.message;
                if (parsed.error && typeof parsed.error === 'string') return parsed.error;
            }
        } catch {
            // not parseable
        }

        // Clean up common prefixes
        msg = msg.replace(/^(OpenAI API Error|Embedding API Error|Error)\s*\(\d+\):\s*/i, '');

        // Truncate raw JSON dumps
        if (msg.length > 300) {
            msg = msg.substring(0, 300) + '...';
        }

        return msg;
    }

    // Gemini / Google error object with errorDetails
    if (err['errorDetails'] && Array.isArray(err['errorDetails'])) {
        const details = err['errorDetails'] as Array<Record<string, string>>;
        if (details.length > 0) {
            return details
                .map(d => d['reason'] || d['message'] || JSON.stringify(d))
                .filter(Boolean)
                .join('; ');
        }
    }

    // Object with status/statusText (Response-like)
    if (err['status'] && err['statusText']) {
        return `HTTP ${err['status']}: ${err['statusText']}`;
    }

    // Last resort: stringify
    try {
        const str = JSON.stringify(error, null, 2);
        if (str && str !== '{}') {
            return str.length > 300 ? str.substring(0, 300) + '...' : str;
        }
    } catch {
        // circular reference
    }

    return String(error).substring(0, 300);
}

/**
 * Parse an API error response body and extract a clean message.
 */
export function parseApiError(status: number, body: string, prefix = 'API Error'): string {
    let cleanMsg = `${prefix} (${status})`;
    try {
        const parsed = JSON.parse(body);
        if (parsed.error?.message) cleanMsg = parsed.error.message;
        else if (parsed.message) cleanMsg = parsed.message;
        else cleanMsg += ': ' + body.substring(0, 200);
    } catch {
        cleanMsg += ': ' + body.substring(0, 200);
    }
    return cleanMsg;
}
