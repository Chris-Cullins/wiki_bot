import 'dotenv/config';
import { loadConfig, type DocumentationDepth } from './config.js';
import { RepoCrawler } from './repo-crawler.js';
import { WikiGenerator } from './wiki-generator.js';
import { GitHubWikiWriter } from './github/github-wiki-writer.js';
import { join, resolve, relative, isAbsolute } from 'path';
import { createQueryFunction } from './query-factory.js';
import { DebugLogger } from './logging.js';

interface CliOptions {
  targetFiles: string[];
  depthOverride?: DocumentationDepth;
}

interface TargetResolutionResult {
  matched: Set<string>;
  unmatched: string[];
}

function parseDepth(input?: string): DocumentationDepth | undefined {
  if (!input) {
    return undefined;
  }
  const normalized = input.toLowerCase();
  if (normalized === 'summary' || normalized === 'standard' || normalized === 'deep') {
    return normalized;
  }
  return undefined;
}

function printHelp(): void {
  console.log('Wiki Bot CLI options:');
  console.log('  --target-file <path>   Only regenerate documentation for the area(s) touching this file');
  console.log('  --depth <level>        Override documentation depth (summary | standard | deep)');
  console.log('  --help                 Show this message');
}

function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = { targetFiles: [] };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--target-file' || arg === '-f') {
      const value = args[i + 1];
      if (!value) {
        throw new Error('Missing value for --target-file');
      }
      options.targetFiles.push(value);
      i += 1;
      continue;
    }

    if (arg.startsWith('--target-file=')) {
      const value = arg.split('=', 2)[1];
      if (!value) {
        throw new Error('Missing value for --target-file');
      }
      options.targetFiles.push(value);
      continue;
    }

    if (arg === '--depth') {
      const value = args[i + 1];
      const depth = parseDepth(value);
      if (!depth) {
        throw new Error(`Unsupported depth "${value ?? ''}". Use summary, standard, or deep.`);
      }
      options.depthOverride = depth;
      i += 1;
      continue;
    }

    if (arg.startsWith('--depth=')) {
      const value = arg.split('=', 2)[1];
      const depth = parseDepth(value);
      if (!depth) {
        throw new Error(`Unsupported depth "${value}". Use summary, standard, or deep.`);
      }
      options.depthOverride = depth;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function normalizeRepoPath(pathCandidate: string): string {
  return pathCandidate.split('\\').join('/');
}

function resolveTargetFiles(
  inputs: string[],
  filePaths: string[],
  repoPath: string,
): TargetResolutionResult {
  const matched = new Set<string>();
  const unmatched: string[] = [];
  const knownFiles = new Set(filePaths.map((path) => normalizeRepoPath(path)));

  for (const input of inputs) {
    const trimmed = input.replace(/^\.\/+/, '');
    const normalizedDirect = normalizeRepoPath(trimmed);
    if (knownFiles.has(normalizedDirect)) {
      matched.add(normalizedDirect);
      continue;
    }

    const absoluteCandidate = isAbsolute(input)
      ? input
      : resolve(repoPath, input);
    const relativeToRepo = normalizeRepoPath(relative(repoPath, absoluteCandidate));

    if (!relativeToRepo.startsWith('..') && knownFiles.has(relativeToRepo)) {
      matched.add(relativeToRepo);
      continue;
    }

    unmatched.push(input);
  }

  return { matched, unmatched };
}

/**
 * Main entry point for the wiki bot application
 */
async function main() {

  console.log('Initializing Wiki Bot...');

  const cliOptions = parseCliArgs(process.argv.slice(2));

  // Load configuration
  const config = loadConfig();

  if (cliOptions.depthOverride) {
    config.documentationDepth = cliOptions.depthOverride;
  }

  const cliTargetFiles = cliOptions.targetFiles;

  // Determine the repository path
  const repoPath = config.repoPath ? resolve(config.repoPath) : process.cwd();

  if (config.templateDir && !isAbsolute(config.templateDir)) {
    config.templateDir = resolve(repoPath, config.templateDir);
  }

  const promptLogDirDefault = join(repoPath, '.wiki-logs');
  if (config.promptLoggingEnabled && !config.promptLogDir) {
    config.promptLogDir = promptLogDirDefault;
  }

  const logger = new DebugLogger({
    enabled: Boolean(config.debug),
    promptLoggingEnabled: config.promptLoggingEnabled,
    promptLogDir: config.promptLoggingEnabled ? config.promptLogDir : undefined,
  });
  if (config.debug) {
    logger.debug('Debug logging enabled');
  }

  const queryFn = createQueryFunction(config, repoPath, logger);

  if (config.testMode) {
    console.log('⚠️  TEST MODE ENABLED - Using mock Agent SDK (no API calls will be made)');
  } else {
    console.log(`Using LLM provider: ${config.llmProvider}`);
  }

  // Ensure the Claude Agent SDK can read authentication details when in use
  if (config.llmProvider === 'agent-sdk') {
    if (config.apiKey && !process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = config.apiKey;
    }
    if (config.apiKey && !process.env.ANTHROPIC_AUTH_TOKEN) {
      process.env.ANTHROPIC_AUTH_TOKEN = config.apiKey;
    }
    if (config.baseURL && !process.env.ANTHROPIC_BASE_URL) {
      process.env.ANTHROPIC_BASE_URL = config.baseURL;
    }
  }

  console.log(`Using repository path: ${repoPath}`);

  console.log('Wiki Bot initialized successfully');

  // Crawl the repository
  console.log('Crawling repository structure...');
  const crawler = new RepoCrawler();
  const repoStructure = await crawler.crawl(repoPath);
  const filePaths = crawler.getFilePaths(repoStructure);
  console.log(`Found ${filePaths.length} files in repository`);

  const { matched: targetFiles, unmatched: unmatchedTargets } = resolveTargetFiles(
    cliTargetFiles,
    filePaths,
    repoPath,
  );

  if (unmatchedTargets.length > 0) {
    console.warn(
      `⚠️  Could not match target file(s): ${unmatchedTargets.join(', ')}`,
    );
  }

  const selectiveRun = targetFiles.size > 0;

  if (selectiveRun) {
    console.log('Selective regeneration mode enabled for files:');
    for (const target of targetFiles) {
      console.log(`  - ${target}`);
    }
    if (!config.incrementalDocs) {
      config.incrementalDocs = true;
    }
  }

  // Initialize wiki generator with appropriate query function
  const wikiGenerator = new WikiGenerator(queryFn, config, logger);

  // Prepare wiki writer if configured
  const wikiWriter = config.wikiRepoUrl
    ? new GitHubWikiWriter({
      wikiRepoUrl: config.wikiRepoUrl,
      localPath: config.wikiRepoPath || join(repoPath, '.wiki'),
      token: config.githubToken,
      defaultBranch: config.wikiRepoBranch,
      commitMessage: config.wikiCommitMessage,
      mode: config.wikiRepoMode,
      shallow: config.wikiRepoShallow,
      cleanupOnFresh: config.wikiFreshClean,
    })
    : undefined;

  const allDocs = new Map<string, string>();
  const updatedPages: string[] = [];
  let pendingPersistStage: string | undefined;

  const sanitizePageName = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) {
      return 'Page';
    }
    if (/^home$/i.test(trimmed)) {
      return 'Home';
    }
    return trimmed
      .replace(/[\\/]+/g, ' ')
      .replace(/[^A-Za-z0-9\s_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const loadExistingDoc = async (
    pageName: string,
    options: { force?: boolean } = {},
  ): Promise<string | undefined> => {
    const shouldLoad = Boolean(wikiWriter) && (
      options.force === true ||
      config.incrementalDocs ||
      config.wikiRepoMode === 'incremental' ||
      config.wikiRepoMode === 'reuse-or-clone'
    );

    if (!shouldLoad || !wikiWriter) {
      return undefined;
    }

    try {
      return await wikiWriter.readPage(pageName);
    } catch (error) {
      console.warn(` Failed to read existing wiki page "${pageName}":`, error);
      return undefined;
    }
  };

  const persistDocs = async (stage: string) => {
    if (!wikiWriter) {
      return;
    }

    if (selectiveRun) {
      pendingPersistStage = stage;
      return;
    }

    console.log(` Writing wiki after ${stage}...`);
    await wikiWriter.writeDocumentation(new Map(allDocs));
  };

  // Generate wiki documentation
  console.log('\nGenerating wiki documentation...');

  // Step 1: Generate Home page
  const homePageName = sanitizePageName('Home');
  if (selectiveRun) {
    const existingHome = await loadExistingDoc(homePageName, { force: true });
    if (existingHome) {
      allDocs.set(homePageName, existingHome);
      console.log(' Reusing existing home page (selective run)');
    } else {
      console.log(' No existing home page found; generating fresh copy');
      const homePage = await wikiGenerator.generateHomePage(repoStructure, existingHome);
      allDocs.set(homePageName, homePage);
      console.log(' Home page generated');
      await persistDocs('home page');
    }
  } else {
    const existingHome = await loadExistingDoc(homePageName);
    const homePage = await wikiGenerator.generateHomePage(repoStructure, existingHome);
    allDocs.set(homePageName, homePage);
    console.log(' Home page generated');
    await persistDocs('home page');
  }

  // Step 2: Generate architectural overview
  const architecturePageName = sanitizePageName('Architecture');
  let archOverview: string;
  if (selectiveRun) {
    const existingArchitecture = await loadExistingDoc(architecturePageName, { force: true });
    if (existingArchitecture) {
      archOverview = existingArchitecture;
      allDocs.set(architecturePageName, existingArchitecture);
      console.log(' Reusing existing architectural overview (selective run)');
    } else {
      archOverview = await wikiGenerator.generateArchitecturalOverview(
        repoStructure,
        existingArchitecture,
      );
      allDocs.set(architecturePageName, archOverview);
      console.log(' Architectural overview generated');
      await persistDocs('architectural overview');
    }
  } else {
    const existingArchitecture = await loadExistingDoc(architecturePageName);
    archOverview = await wikiGenerator.generateArchitecturalOverview(
      repoStructure,
      existingArchitecture,
    );
    allDocs.set(architecturePageName, archOverview);
    console.log(' Architectural overview generated');
    await persistDocs('architectural overview');
  }

  // Step 3: Extract architectural areas
  const areas = await wikiGenerator.extractArchitecturalAreas(archOverview);
  console.log(` Identified ${areas.length} architectural areas: ${areas.join(', ')}`);

  // Step 4: Generate documentation for each area
  for (const area of areas) {
    console.log(`\nDocumenting area: ${area}`);

    const relevantFiles = await wikiGenerator.identifyRelevantFiles(
      area,
      filePaths,
      repoStructure,
    );
    console.log(`  - Found ${relevantFiles.length} relevant files`);
    const pageName = sanitizePageName(area);
    const existingAreaDoc = await loadExistingDoc(pageName, { force: selectiveRun });
    const intersectsTarget = !selectiveRun
      ? true
      : relevantFiles.some((file) => targetFiles.has(file));

    if (relevantFiles.length === 0) {
      if (existingAreaDoc) {
        allDocs.set(pageName, existingAreaDoc);
      }
      console.log(`   No relevant files found for ${area}, skipping`);
      continue;
    }

    if (!intersectsTarget) {
      if (selectiveRun) {
        console.log('   Skipping area (no targeted files matched)');
      }
      if (existingAreaDoc) {
        allDocs.set(pageName, existingAreaDoc);
      }
      continue;
    }

    const doc = await wikiGenerator.generateAreaDocumentation(
      area,
      relevantFiles,
      existingAreaDoc,
    );
    allDocs.set(pageName, doc);
    console.log(`   Documentation generated for ${area}`);
    await persistDocs(`area ${area}`);
    updatedPages.push(pageName);
  }

  if (wikiWriter && selectiveRun) {
    if (updatedPages.length === 0) {
      console.warn('⚠️  No documentation pages matched the requested target files; skipping wiki write');
    } else {
      const stageLabel = pendingPersistStage ?? 'selective regeneration';
      console.log(` Writing wiki after ${stageLabel}...`);
      await wikiWriter.writeDocumentation(new Map(allDocs));
    }
  }

  console.log('\n Generated Documentation Pages:');
  for (const [page, _content] of allDocs) {
    console.log(`  - ${page}`);
  }

  if (!wikiWriter) {
    console.log('\nNo GitHub wiki configuration found; skipping wiki write');
  }

  // TODO: Implement CI integration mode
  // TODO: Implement documentation review mode

  console.log('\nWiki Bot completed successfully');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
