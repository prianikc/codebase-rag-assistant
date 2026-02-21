// Utility for vector mathematics
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface ChunkMetadata {
    text: string;
    startIndex: number;
    endIndex: number;
}

// Improved chunking with metadata
export function chunkTextDetailed(text: string, chunkSize: number = 600, overlap: number = 100): ChunkMetadata[] {
    if (text.length <= chunkSize) {
        return [{ text, startIndex: 0, endIndex: text.length }];
    }

    const chunks: ChunkMetadata[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        let endIndex = startIndex + chunkSize;

        // If we are not at the end of the text, try to snap to a code-friendly delimiter
        if (endIndex < text.length) {
            // Priority 1: Newline (cleanest break)
            let splitIndex = text.lastIndexOf('\n', endIndex);

            // If no newline in the last 20% of the chunk, try a semicolon or brace
            if (splitIndex < startIndex + (chunkSize * 0.8)) {
                const semi = text.lastIndexOf(';', endIndex);
                const brace = text.lastIndexOf('}', endIndex);
                splitIndex = Math.max(semi, brace);
            }

            // If we found a good split point that isn't too far back
            if (splitIndex > startIndex + (chunkSize * 0.5)) {
                endIndex = splitIndex + 1; // Include the delimiter
            }
        } else {
            endIndex = text.length;
        }

        const chunkText = text.slice(startIndex, endIndex);

        chunks.push({
            text: chunkText,
            startIndex,
            endIndex
        });

        // Stop loop if we reached the end
        if (endIndex >= text.length) break;

        // Move forward, minus overlap
        startIndex = endIndex - overlap;
    }

    return chunks;
}

// Keep original for backward compatibility if needed, but wrapper around detailed
export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    return chunkTextDetailed(text, chunkSize, overlap).map(c => c.text);
}
