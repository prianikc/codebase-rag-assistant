/** Vector store types */

export interface VectorDocument {
    id: string;
    filePath: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
}

export interface SearchResult {
    doc: VectorDocument;
    score: number;
}

export interface ChunkInfo {
    text: string;
    startIndex: number;
    endIndex: number;
}
