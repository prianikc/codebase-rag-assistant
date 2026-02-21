/**
 * Represents a node in a file/folder tree.
 * Used by the sidebar file explorer and project instructions tree.
 */
export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children: FileNode[];
    isOpen: boolean;
    level: number;
}
