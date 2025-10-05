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
  };
}
