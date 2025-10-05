import type { RepositoryMode } from './wiki-storage/git-repository-manager.js';

/**
 * Configuration management for the wiki bot
 */
export interface Config {
  /** Anthropic API key for the Agent SDK */
  apiKey: string;
  /** Optional base URL for Anthropic API */
  baseURL?: string;
  /** Target GitHub repository URL */
  repoUrl?: string;
  /** Path to local repository (if working with local repo) */
  repoPath?: string;
  /** Personal access token for writing to GitHub wikis */
  githubToken?: string;
  /** Git URL for the target wiki repository */
  wikiRepoUrl?: string;
  /** Local checkout path for the wiki repository */
  wikiRepoPath?: string;
  /** Branch to push wiki updates to */
  wikiRepoBranch?: string;
  /** Optional override for wiki commit message */
  wikiCommitMessage?: string;
  /** Repository management mode (fresh, incremental, or reuse-or-clone) */
  wikiRepoMode?: RepositoryMode;
  /** Use shallow clone for faster initial setup */
  wikiRepoShallow?: boolean;
  /** Enable test mode to skip Agent SDK calls (saves API costs) */
  testMode?: boolean;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const testMode = process.env.TEST_MODE === 'true';
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || (testMode ? 'test-mode-key' : '');

  if (!apiKey && !testMode) {
    throw new Error('ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY environment variable is required');
  }

  // Parse repository mode from environment
  const rawMode = process.env.WIKI_REPO_MODE?.toLowerCase();
  let wikiRepoMode: RepositoryMode | undefined;
  if (rawMode === 'fresh' || rawMode === 'incremental' || rawMode === 'reuse-or-clone') {
    wikiRepoMode = rawMode;
  }

  return {
    apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    repoUrl: process.env.REPO_URL,
    repoPath: process.env.REPO_PATH,
    githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    wikiRepoUrl: process.env.GITHUB_WIKI_URL || process.env.WIKI_REPO_URL,
    wikiRepoPath: process.env.GITHUB_WIKI_PATH || process.env.WIKI_REPO_PATH,
    wikiRepoBranch: process.env.GITHUB_WIKI_BRANCH,
    wikiCommitMessage: process.env.GITHUB_WIKI_COMMIT_MESSAGE,
    wikiRepoMode,
    wikiRepoShallow: process.env.WIKI_REPO_SHALLOW === 'true',
    testMode,
  };
}
