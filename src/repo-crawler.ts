import { readdir, stat } from 'fs/promises';
import { join, relative } from 'path';

/**
 * Represents a file or directory in the repository
 */
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

/**
 * Crawls a repository and builds a file structure tree
 */
export class RepoCrawler {
  private ignoredPaths = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '.cache',
  ]);

  /**
   * Crawl the repository starting from the given path
   */
  async crawl(repoPath: string): Promise<FileNode> {
    return this.crawlDirectory(repoPath, repoPath);
  }

  /**
   * Recursively crawl a directory
   */
  private async crawlDirectory(dirPath: string, rootPath: string): Promise<FileNode> {
    const entries = await readdir(dirPath);
    const children: FileNode[] = [];

    for (const entry of entries) {
      // Skip ignored paths
      if (this.ignoredPaths.has(entry)) {
        continue;
      }

      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);
      const relativePath = relative(rootPath, fullPath);

      if (stats.isDirectory()) {
        const node = await this.crawlDirectory(fullPath, rootPath);
        children.push(node);
      } else if (stats.isFile()) {
        children.push({
          name: entry,
          path: relativePath,
          type: 'file',
        });
      }
    }

    return {
      name: dirPath === rootPath ? 'root' : relative(rootPath, dirPath).split('/').pop() || '',
      path: relative(rootPath, dirPath) || '.',
      type: 'directory',
      children,
    };
  }

  /**
   * Get a flat list of all file paths in the repository
   */
  getFilePaths(tree: FileNode): string[] {
    const paths: string[] = [];

    const traverse = (node: FileNode) => {
      if (node.type === 'file') {
        paths.push(node.path);
      } else if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(tree);
    return paths;
  }
}
