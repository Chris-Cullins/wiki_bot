import { readdir, stat, readFile } from 'fs/promises';
import { join, relative, sep } from 'path';
import ignore, { Ignore } from 'ignore';

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
  private readonly defaultIgnorePatterns = [
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    '.cache/',
    '.wiki/',
    '.wiki.ao/',
  ];

  private ignoreFilter: Ignore | undefined;

  /**
   * Crawl the repository starting from the given path
   */
  async crawl(repoPath: string): Promise<FileNode> {
    this.ignoreFilter = await this.buildIgnoreFilter(repoPath);
    return this.crawlDirectory(repoPath, repoPath);
  }

  /**
   * Recursively crawl a directory
   */
  private async crawlDirectory(dirPath: string, rootPath: string): Promise<FileNode> {
    const entries = await readdir(dirPath);
    const children: FileNode[] = [];

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);
      const relativePathCandidate = relative(rootPath, fullPath) || entry;
      const normalizedPath = this.normalizePath(relativePathCandidate);

      if (this.shouldIgnore(normalizedPath, stats.isDirectory())) {
        continue;
      }

      if (stats.isDirectory()) {
        const node = await this.crawlDirectory(fullPath, rootPath);
        children.push(node);
      } else if (stats.isFile()) {
        children.push({
          name: entry,
          path: normalizedPath,
          type: 'file',
        });
      }
    }

    const dirRelative = dirPath === rootPath ? '.' : relative(rootPath, dirPath);
    const normalizedDirPath = dirRelative === '.' ? '.' : this.normalizePath(dirRelative);

    return {
      name: dirPath === rootPath ? 'root' : normalizedDirPath.split('/').pop() || '',
      path: normalizedDirPath,
      type: 'directory',
      children,
    };
  }

  private async buildIgnoreFilter(rootPath: string): Promise<Ignore> {
    const filter = ignore();
    filter.add(this.defaultIgnorePatterns);

    try {
      const gitignorePath = join(rootPath, '.gitignore');
      const gitignoreContents = await readFile(gitignorePath, 'utf-8');
      filter.add(gitignoreContents);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return filter;
  }

  private shouldIgnore(relativePath: string, isDirectory: boolean): boolean {
    if (!relativePath) {
      return false;
    }
    if (!this.ignoreFilter) {
      return false;
    }

    if (this.ignoreFilter.ignores(relativePath)) {
      return true;
    }

    if (isDirectory && this.ignoreFilter.ignores(`${relativePath}/`)) {
      return true;
    }

    return false;
  }

  private normalizePath(pathCandidate: string): string {
    if (!pathCandidate) {
      return '';
    }

    return pathCandidate.split(sep).join('/');
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
