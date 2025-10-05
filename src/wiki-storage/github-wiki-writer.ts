import { writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import {
  GitRepositoryManager,
  type RepositoryMode,
} from './git-repository-manager.js';

export interface GitHubWikiWriterOptions {
  /** Remote git URL for the wiki repository */
  wikiRepoUrl: string;
  /** Local path where the wiki repository should live */
  localPath: string;
  /** Personal access token used for HTTPS authentication */
  token?: string;
  /** Branch to push changes to (defaults to master for GitHub wikis) */
  defaultBranch?: string;
  /** Commit message to use when updates are detected */
  commitMessage?: string;
  /** Repository management mode (defaults to 'incremental') */
  mode?: RepositoryMode;
  /** Use shallow clone for faster initial setup */
  shallow?: boolean;
}

/**
 * Persists generated documentation to a GitHub wiki repository
 */
export class GitHubWikiWriter {
  private readonly _localPath: string;
  private readonly _commitMessage: string;
  private readonly _repoManager: GitRepositoryManager;

  constructor(private readonly _options: GitHubWikiWriterOptions) {
    this._localPath = resolve(_options.localPath);
    this._commitMessage = _options.commitMessage ?? 'Update wiki documentation';

    this._repoManager = new GitRepositoryManager({
      remoteUrl: _options.wikiRepoUrl,
      localPath: this._localPath,
      token: _options.token,
      branch: _options.defaultBranch ?? 'master',
      mode: _options.mode ?? 'incremental',
      shallow: _options.shallow ?? false,
    });
  }

  /**
   * Write a set of wiki pages and push changes to the remote wiki repository
   */
  async writeDocumentation(pages: Map<string, string>): Promise<void> {
    if (pages.size === 0) {
      console.warn('No documentation pages provided; skipping wiki write');
      return;
    }

    // Prepare repository (clone or update based on mode)
    await this._repoManager.prepare();

    // Check repository status before writing
    const status = await this._repoManager.status();
    if (!status.clean) {
      console.warn(
        `Warning: Wiki repository has uncommitted changes:\n${status.uncommittedChanges.join('\n')}`,
      );
    }

    // Write documentation files
    await this.writePages(pages);
    await this.writeSidebar(pages);

    // Commit and push if there are changes
    await this.commitAndPush();
  }

  /**
   * Persist each generated page into the wiki repository
   */
  private async writePages(pages: Map<string, string>): Promise<void> {
    for (const [pageName, content] of pages) {
      const fileName = this.mapPageNameToFile(pageName);
      const filePath = join(this._localPath, `${fileName}.md`);
      await writeFile(filePath, ensureTrailingNewline(content), 'utf-8');
    }
  }

  /**
   * Generate a simple sidebar for quick navigation between pages
   */
  private async writeSidebar(pages: Map<string, string>): Promise<void> {
    const orderedPages = this.orderPagesForSidebar(pages);
    const sidebarLines = orderedPages.map((name) => `* [[${name}]]`);
    const sidebarContent = `${sidebarLines.join('\n')}\n`;
    const sidebarPath = join(this._localPath, '_Sidebar.md');
    await writeFile(sidebarPath, sidebarContent, 'utf-8');
  }

  /**
   * Stage, commit, and push wiki updates
   */
  private async commitAndPush(): Promise<void> {
    const committed = await this._repoManager.commit(this._commitMessage);

    if (!committed) {
      console.log('Wiki already up to date; no changes to push');
      return;
    }

    await this._repoManager.push();
    console.log('Wiki changes pushed successfully');
  }

  /**
   * Convert a human readable page name into a file system friendly slug
   */
  private mapPageNameToFile(pageName: string): string {
    const trimmed = pageName.trim();

    if (!trimmed) {
      return 'Page';
    }

    if (trimmed.toLowerCase() === 'home') {
      return 'Home';
    }

    return trimmed
      .replace(/[^A-Za-z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  /**
   * Determine the order of pages to show in the sidebar
   */
  private orderPagesForSidebar(pages: Map<string, string>): string[] {
    const names = Array.from(pages.keys());

    const hasHome = names.find((name) => name.toLowerCase() === 'home');
    const hasArchitecture = names.find((name) => name.toLowerCase() === 'architecture');

    const rest = names
      .filter((name) => name !== hasHome && name !== hasArchitecture)
      .sort((a, b) => a.localeCompare(b));

    const ordered: string[] = [];
    if (hasHome) {
      ordered.push(hasHome);
    }
    if (hasArchitecture) {
      ordered.push(hasArchitecture);
    }
    ordered.push(...rest);

    return ordered;
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}
