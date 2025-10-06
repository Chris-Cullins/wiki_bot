import type { RepositoryMode } from './github/git-repository-manager.js';

export type DocumentationDepth = 'summary' | 'standard' | 'deep';

export type LlmProvider = 'agent-sdk' | 'claude-cli' | 'codex-cli';

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
  /** Delete existing wiki markdown files when running in fresh mode */
  wikiFreshClean?: boolean;
  /** Enable test mode to skip Agent SDK calls (saves API costs) */
  testMode?: boolean;
  /** Enable incremental documentation updates (reuse existing wiki content) */
  incrementalDocs?: boolean;
  /** Model provider to power prompt execution */
  llmProvider: LlmProvider;
  /** Emit verbose debug logging */
  debug?: boolean;
  /** Persist full prompt/response transcripts for debugging */
  promptLoggingEnabled?: boolean;
  /** Directory where prompt/response transcripts should be stored */
  promptLogDir?: string;
  /** Desired level of detail for generated documentation */
  documentationDepth: DocumentationDepth;
  /** Optional override path for page templates */
  templateDir?: string;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const rawProvider = process.env.LLM_PROVIDER?.toLowerCase();
  let llmProvider: LlmProvider = 'agent-sdk';
  if (rawProvider) {
    if (rawProvider === 'claude-cli' || rawProvider === 'claude') {
      llmProvider = 'claude-cli';
    } else if (rawProvider === 'codex-cli' || rawProvider === 'codex') {
      llmProvider = 'codex-cli';
    } else if (rawProvider === 'agent-sdk' || rawProvider === 'anthropic') {
      llmProvider = 'agent-sdk';
    }
  }

  const testMode = process.env.TEST_MODE === 'true';
  const debug = process.env.DEBUG === 'true';

  const promptLoggingSetting = process.env.PROMPT_LOG_ENABLED?.toLowerCase();
  let promptLoggingEnabled: boolean;
  if (promptLoggingSetting === 'true' || promptLoggingSetting === '1' || promptLoggingSetting === 'yes') {
    promptLoggingEnabled = true;
  } else if (
    promptLoggingSetting === 'false' ||
    promptLoggingSetting === '0' ||
    promptLoggingSetting === 'no'
  ) {
    promptLoggingEnabled = false;
  } else {
    promptLoggingEnabled = debug;
  }

  const promptLogDir = process.env.PROMPT_LOG_DIR;

  const rawDepth = process.env.DOC_DEPTH?.toLowerCase();
  let documentationDepth: DocumentationDepth = 'standard';
  if (rawDepth === 'summary' || rawDepth === 'deep' || rawDepth === 'standard') {
    documentationDepth = rawDepth;
  }
  const apiKey =
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_API_KEY ||
    (testMode ? 'test-mode-key' : '');

  const requiresAnthropicKey = llmProvider === 'agent-sdk';

  if (!apiKey && !testMode && requiresAnthropicKey) {
    throw new Error('ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY environment variable is required');
  }

  // Parse repository mode from environment
  const rawMode = process.env.WIKI_REPO_MODE?.toLowerCase();
  let wikiRepoMode: RepositoryMode | undefined;
  if (rawMode === 'fresh' || rawMode === 'incremental' || rawMode === 'reuse-or-clone') {
    wikiRepoMode = rawMode;
  }

  const incrementalDocsEnv = process.env.INCREMENTAL_DOCS?.toLowerCase();
  let incrementalDocs: boolean;
  if (incrementalDocsEnv === 'true' || incrementalDocsEnv === '1' || incrementalDocsEnv === 'yes') {
    incrementalDocs = true;
  } else if (
    incrementalDocsEnv === 'false' ||
    incrementalDocsEnv === '0' ||
    incrementalDocsEnv === 'no'
  ) {
    incrementalDocs = false;
  } else {
    incrementalDocs = wikiRepoMode === 'incremental' || wikiRepoMode === 'reuse-or-clone';
  }

  const freshCleanEnv = process.env.WIKI_FRESH_CLEAN?.toLowerCase();
  const wikiFreshClean =
    freshCleanEnv === 'true' || freshCleanEnv === '1' || freshCleanEnv === 'yes';

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
    incrementalDocs,
    wikiFreshClean,
    llmProvider,
    debug,
    promptLoggingEnabled,
    promptLogDir,
    documentationDepth,
    templateDir: process.env.TEMPLATE_DIR,
  };
}
