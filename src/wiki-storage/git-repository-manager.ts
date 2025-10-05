import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { dirname, join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type RepositoryMode = 'fresh' | 'incremental' | 'reuse-or-clone';

export interface GitRepositoryManagerOptions {
  /** Remote repository URL */
  remoteUrl: string;
  /** Local path where repository should be cloned */
  localPath: string;
  /** Personal access token for authentication */
  token?: string;
  /** Target branch to work with */
  branch?: string;
  /** Repository management mode */
  mode?: RepositoryMode;
  /** Use shallow clone for faster initial setup */
  shallow?: boolean;
}

export interface RepositoryStatus {
  exists: boolean;
  clean: boolean;
  branch: string;
  ahead: number;
  behind: number;
  uncommittedChanges: string[];
}

/**
 * Manages git repository operations with proper state handling
 */
export class GitRepositoryManager {
  private readonly _localPath: string;
  private readonly _remoteUrl: string;
  private readonly _token?: string;
  private readonly _branch: string;
  private readonly _mode: RepositoryMode;
  private readonly _shallow: boolean;

  constructor(options: GitRepositoryManagerOptions) {
    this._localPath = options.localPath;
    this._remoteUrl = options.remoteUrl;
    this._token = options.token;
    this._branch = options.branch ?? 'master';
    this._mode = options.mode ?? 'incremental';
    this._shallow = options.shallow ?? false;
  }

  /**
   * Prepare the repository for use based on the configured mode
   */
  async prepare(): Promise<void> {
    const exists = await this.exists();

    switch (this._mode) {
      case 'fresh':
        if (exists) {
          await this.clean();
        }
        await this.clone();
        break;

      case 'incremental':
        if (exists) {
          await this.update();
        } else {
          await this.clone();
        }
        break;

      case 'reuse-or-clone':
        if (!exists) {
          await this.clone();
        }
        // Reuse existing repo as-is
        break;
    }
  }

  /**
   * Check if the repository exists locally
   */
  async exists(): Promise<boolean> {
    const gitDir = join(this._localPath, '.git');
    return existsSync(gitDir);
  }

  /**
   * Get the current status of the repository
   */
  async status(): Promise<RepositoryStatus> {
    if (!(await this.exists())) {
      return {
        exists: false,
        clean: true,
        branch: '',
        ahead: 0,
        behind: 0,
        uncommittedChanges: [],
      };
    }

    const [branch, porcelain, tracking] = await Promise.all([
      this.getCurrentBranch(),
      this.runGit(['status', '--porcelain']),
      this.runGit(['rev-list', '--left-right', '--count', `origin/${this._branch}...HEAD`], {
        allowFailure: true,
      }),
    ]);

    const uncommittedChanges = porcelain.stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);

    const [behind, ahead] = tracking.stdout
      .trim()
      .split('\t')
      .map((n) => parseInt(n, 10) || 0);

    return {
      exists: true,
      clean: uncommittedChanges.length === 0,
      branch,
      ahead,
      behind,
      uncommittedChanges,
    };
  }

  /**
   * Clone the repository from the remote
   */
  async clone(): Promise<void> {
    const url = this.buildAuthUrl();
    const parentDir = dirname(this._localPath);

    await mkdir(parentDir, { recursive: true });

    const args = ['clone', url, this._localPath];
    if (this._shallow) {
      args.splice(1, 0, '--depth', '1');
    }
    if (this._branch) {
      args.splice(1, 0, '--branch', this._branch);
    }

    await this.runGit(args, { cwd: parentDir, sanitize: true });
  }

  /**
   * Update the repository to the latest remote state
   */
  async update(): Promise<void> {
    const status = await this.status();

    if (!status.clean) {
      throw new Error(
        `Cannot update: repository has uncommitted changes:\n${status.uncommittedChanges.join('\n')}`,
      );
    }

    // Fetch latest changes
    await this.runGit(['fetch', 'origin']);

    // Switch to target branch if needed
    if (status.branch !== this._branch) {
      await this.runGit(['checkout', this._branch]);
    }

    // Reset to remote state (only safe because we checked for uncommitted changes)
    await this.runGit(['reset', '--hard', `origin/${this._branch}`]);
  }

  /**
   * Stage all changes in the repository
   */
  async stageAll(): Promise<void> {
    await this.runGit(['add', '.']);
  }

  /**
   * Create a commit with the given message
   */
  async commit(message: string): Promise<boolean> {
    const status = await this.status();
    if (status.clean) {
      return false; // Nothing to commit
    }

    await this.runGit(['add', '.']);

    try {
      await this.runGit(['commit', '-m', message]);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('nothing to commit')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Push commits to the remote repository
   */
  async push(): Promise<void> {
    await this.runGit(['push', 'origin', `HEAD:${this._branch}`], { sanitize: true });
  }

  /**
   * Remove the local repository
   */
  async clean(): Promise<void> {
    if (await this.exists()) {
      await rm(this._localPath, { recursive: true, force: true });
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const { stdout } = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout.trim();
  }

  /**
   * Switch to a specific branch
   */
  async checkout(branch: string): Promise<void> {
    await this.runGit(['checkout', branch]);
  }

  /**
   * Execute a git command
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

      const commandText = options?.sanitize ? this.sanitizeGitArgs(args) : args.join(' ');
      throw new Error(
        `git ${commandText} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build authenticated URL for git operations
   */
  private buildAuthUrl(): string {
    if (!this._token || !this._remoteUrl.startsWith('http')) {
      return this._remoteUrl;
    }

    try {
      const url = new URL(this._remoteUrl);
      url.username = 'x-access-token';
      url.password = this._token;
      return url.toString();
    } catch {
      return this._remoteUrl;
    }
  }

  /**
   * Redact credentials when logging git commands
   */
  private sanitizeGitArgs(args: string[]): string {
    return args.map((arg) => (arg.includes('://') ? '<redacted-url>' : arg)).join(' ');
  }
}
