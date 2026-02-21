/** File filter constants for knowledge base ingestion */

/** Binary extensions that cannot be meaningfully read as text */
export const BINARY_EXTENSIONS = new Set([
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.avif', '.bmp', '.tiff', '.psd',
    // Audio/Video
    '.mp4', '.mp3', '.wav', '.ogg', '.webm', '.mov', '.avi', '.mkv', '.flac', '.aac',
    // Archives
    '.zip', '.tar', '.gz', '.tgz', '.rar', '.7z', '.iso', '.dmg',
    // Documents (Binary)
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    // Executables / Libs
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib', '.class', '.pyc', '.pyd',
    // Databases
    '.db', '.sqlite', '.sqlite3', '.mdb', '.parquet',
    // Misc
    '.ds_store', '.map', '.woff', '.woff2', '.ttf', '.eot', '.suo', '.ntvs', '.njsproj',
]);

/** Directories to skip during ingestion */
export const BLOCKED_DIRECTORIES = new Set([
    'node_modules', '.git', '.angular', '.nx', '.vscode', '.idea',
    'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '.cache',
    '__pycache__', 'venv', 'target', 'vendor', 'bin', 'obj', '.gradle',
]);

/** Lock files and system files to skip */
export const BLOCKED_FILENAMES = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
    'cargo.lock', 'gemfile.lock', 'composer.lock', 'poetry.lock',
    '.yarn-integrity', '.ds_store', 'thumbs.db',
]);

/** Default concurrency for embedding operations */
export const EMBEDDING_CONCURRENCY = 4;

/** Default download concurrency for GitHub repo fetching */
export const DOWNLOAD_CONCURRENCY = 10;

/**
 * Check if a file path should be allowed for ingestion.
 * Blocks binary files, system directories, and lock files.
 */
export function isFileAllowed(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    const parts = lower.split('/');
    const fileName = parts[parts.length - 1];

    // 1. Blocked filename
    if (BLOCKED_FILENAMES.has(fileName)) return false;

    // 2. Blocked directory
    for (const part of parts) {
        if (BLOCKED_DIRECTORIES.has(part)) return false;
    }

    // 3. Binary extension
    if (fileName.includes('.')) {
        const ext = fileName.substring(fileName.lastIndexOf('.'));
        if (BINARY_EXTENSIONS.has(ext)) return false;
    }

    return true;
}
