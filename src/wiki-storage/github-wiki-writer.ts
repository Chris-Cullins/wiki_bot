import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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
}

/**
 * Persists generated documentation to a GitHub wiki repository
 */
export class GitHubWikiWriter {
  private readonly _localPath: string;
  private readonly _defaultBranch: string;
  private readonly _commitMessage: string;
  private _prepared = false;

  constructor(private readonly _options: GitHubWikiWriterOptions) {
    this._localPath = resolve(_options.localPath);
    this._defaultBranch = _options.defaultBranch ?? 'master';
    this._commitMessage = _options.commitMessage ?? 'Update wiki documentation';
  }

  /**
   * Write a set of wiki pages and push changes to the remote wiki repository
   */
  async writeDocumentation(pages: Map<string, string>): Promise<void> {
    if (pages.size === 0) {
      console.warn('No documentation pages provided; skipping wiki write');
      return;
    }

    await this.prepareRepository();

    await this.writePages(pages);
    await this.writeSidebar(pages);

    await this.commitAndPush();
  }

  /**
   * Ensure the wiki repository exists locally and is up to date
   */
  private async prepareRepository(): Promise<void> {
    if (this._prepared) {
      return;
    }

    const gitDir = join(this._localPath, '.git');

    if (!existsSync(gitDir)) {
      await this.cloneRepository();
    } else {
      await this.updateRepository();
    }

    this._prepared = true;
  }

  /**
   * Clone the wiki repository from GitHub
   */
  private async cloneRepository(): Promise<void> {
    const url = this.buildAuthUrl();
    const parentDir = dirname(this._localPath);

    await mkdir(parentDir, { recursive: true });

    await this.runGit(['clone', url, this._localPath], { cwd: parentDir, sanitize: true });
    await this.checkoutDefaultBranch();
  }

  /**
   * Fetch the latest changes from the remote wiki repository
   */
  private async updateRepository(): Promise<void> {
    await this.runGit(['fetch', 'origin']);
    await this.checkoutDefaultBranch();
    await this.runGit(['reset', '--hard', `origin/${this._defaultBranch}`], { sanitize: true });
  }

  /**
   * Force the working tree onto the target branch to keep it aligned with remote
   */
  private async checkoutDefaultBranch(): Promise<void> {
    const { stdout } = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    const currentBranch = stdout.trim();

    if (currentBranch !== this._defaultBranch) {
      await this.runGit(['checkout', this._defaultBranch], { allowFailure: true, sanitize: true });
    }
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
    const status = await this.runGit(['status', '--porcelain']);
    if (!status.stdout.trim()) {
      console.log('Wiki already up to date; no changes to push');
      return;
    }

    await this.runGit(['add', '.']);

    try {
      await this.runGit(['commit', '-m', this._commitMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('nothing to commit')) {
        console.log('No commit created; working tree clean after staging');
      } else {
        throw error;
      }
    }

    await this.runGit(['push', 'origin', `HEAD:${this._defaultBranch}`], { sanitize: true });
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

  /**
   * Execute a git command with optional specialised handling
   */
  private async runGit(
    args: string[],
    options?: { cwd?: string; allowFailure?: boolean; sanitize?: boolean },
  ): Promise<{ stdout: string; stderr: string }> {
    const cwd = options?.cwd ?? this._localPath;

    try {
      const result = await execFileAsync('git', args, {
        cwd,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
        },
        maxBuffer: 10 * 1024 * 1024,
      });

      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      if (options?.allowFailure) {
        return { stdout: '', stderr: '' };
      }

      const commandText = options?.sanitize ? this.sanitiseGitArgs(args) : args.join(' ');
      throw new Error(`git ${commandText} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build the authenticated URL used for clone/push commands
   */
  private buildAuthUrl(): string {
    const { wikiRepoUrl, token } = this._options;

    if (!token || !wikiRepoUrl.startsWith('http')) {
      return wikiRepoUrl;
    }

    try {
      const url = new URL(wikiRepoUrl);
      url.username = 'x-access-token';
      url.password = token;
      return url.toString();
    } catch {
      return wikiRepoUrl;
    }
  }

  /**
   * Redact credentials when reporting git commands
   */
  private sanitiseGitArgs(args: string[]): string {
    return args
      .map((arg) => (arg.includes('://') ? '<redacted-url>' : arg))
      .join(' ');
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}
