import 'dotenv/config';
import { loadConfig } from './config.js';
import { RepoCrawler } from './repo-crawler.js';
import { WikiGenerator } from './wiki-generator.js';
import { GitHubWikiWriter } from './github/github-wiki-writer.js';
import { join, resolve } from 'path';
import { createQueryFunction } from './query-factory.js';

/**
 * Main entry point for the wiki bot application
 */
async function main() {

  console.log('Initializing Wiki Bot...');

  // Load configuration
  const config = loadConfig();

  // Determine the repository path
  const repoPath = config.repoPath ? resolve(config.repoPath) : process.cwd();

  const queryFn = createQueryFunction(config, repoPath);

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

  // Initialize wiki generator with appropriate query function
  const wikiGenerator = new WikiGenerator(queryFn, config);

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
    })
    : undefined;

  const allDocs = new Map<string, string>();

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

  const loadExistingDoc = async (pageName: string): Promise<string | undefined> => {
    if (!config.incrementalDocs || !wikiWriter) {
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

    console.log(` Writing wiki after ${stage}...`);
    await wikiWriter.writeDocumentation(new Map(allDocs));
  };

  // Generate wiki documentation
  console.log('\nGenerating wiki documentation...');

  // Step 1: Generate Home page
  const homePageName = sanitizePageName('Home');
  const existingHome = await loadExistingDoc(homePageName);
  const homePage = await wikiGenerator.generateHomePage(repoStructure, existingHome);
  allDocs.set(homePageName, homePage);
  console.log(' Home page generated');
  await persistDocs('home page');

  // Step 2: Generate architectural overview
  const architecturePageName = sanitizePageName('Architecture');
  const existingArchitecture = await loadExistingDoc(architecturePageName);
  const archOverview = await wikiGenerator.generateArchitecturalOverview(
    repoStructure,
    existingArchitecture,
  );
  allDocs.set(architecturePageName, archOverview);
  console.log(' Architectural overview generated');
  await persistDocs('architectural overview');

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

    if (relevantFiles.length > 0) {
      const pageName = sanitizePageName(area);
      const existingAreaDoc = await loadExistingDoc(pageName);
      const doc = await wikiGenerator.generateAreaDocumentation(
        area,
        relevantFiles,
        existingAreaDoc,
      );
      allDocs.set(pageName, doc);
      console.log(`   Documentation generated for ${area}`);
      await persistDocs(`area ${area}`);
    } else {
      console.log(`   No relevant files found for ${area}, skipping`);
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
