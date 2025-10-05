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
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY environment variable is required');
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
  };
}
