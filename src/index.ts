import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createMockQuery } from './mock-agent-sdk.js';
import { loadConfig } from './config.js';
import { RepoCrawler } from './repo-crawler.js';
import { WikiGenerator } from './wiki-generator.js';
import { GitHubWikiWriter } from './wiki-storage/github-wiki-writer.js';
import { join } from 'path';

/**
 * Main entry point for the wiki bot application
 */
async function main() {

  console.log('Initializing Wiki Bot...');

  // Load configuration
  const config = loadConfig();

  // Use mock query in test mode
  const queryFn = config.testMode ? createMockQuery() : query;

  if (config.testMode) {
    console.log('⚠️  TEST MODE ENABLED - Using mock Agent SDK (no API calls will be made)');
  }

  // Ensure the Claude Agent CLI can read authentication details
  if (!process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = config.apiKey;
  }
  if (!process.env.ANTHROPIC_AUTH_TOKEN) {
    process.env.ANTHROPIC_AUTH_TOKEN = config.apiKey;
  }
  if (config.baseURL && !process.env.ANTHROPIC_BASE_URL) {
    process.env.ANTHROPIC_BASE_URL = config.baseURL;
  }

  // Determine the repository path
  const repoPath = config.repoPath || process.cwd();
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

  // Generate wiki documentation
  console.log('\nGenerating wiki documentation...');

  // Step 1: Generate Home page
  const homePage = await wikiGenerator.generateHomePage(repoStructure);
  console.log(' Home page generated');

  // Step 2: Generate architectural overview
  const archOverview = await wikiGenerator.generateArchitecturalOverview(repoStructure);
  console.log(' Architectural overview generated');

  // Step 3: Extract architectural areas
  const areas = await wikiGenerator.extractArchitecturalAreas(archOverview);
  console.log(` Identified ${areas.length} architectural areas: ${areas.join(', ')}`);

  // Step 4: Generate documentation for each area
  const areaDocumentation = new Map<string, string>();

  for (const area of areas) {
    console.log(`\nDocumenting area: ${area}`);

    // Identify relevant files for this area
    const relevantFiles = await wikiGenerator.identifyRelevantFiles(
      area,
      filePaths,
      repoStructure,
    );
    console.log(`  - Found ${relevantFiles.length} relevant files`);

    if (relevantFiles.length > 0) {
      // Generate documentation for this area
      const doc = await wikiGenerator.generateAreaDocumentation(area, relevantFiles);
      areaDocumentation.set(area, doc);
      console.log(`   Documentation generated for ${area}`);
    } else {
      console.log(`   No relevant files found for ${area}, skipping`);
    }
  }

  // Store all generated documentation
  const allDocs = new Map<string, string>([
    ['Home', homePage],
    ['Architecture', archOverview],
    ...areaDocumentation,
  ]);

  console.log('\n Generated Documentation Pages:');
  for (const [page, _content] of allDocs) {
    console.log(`  - ${page}`);
  }

  if (config.wikiRepoUrl) {
    console.log('\nWriting documentation to GitHub wiki...');

    const wikiWriter = new GitHubWikiWriter({
      wikiRepoUrl: config.wikiRepoUrl,
      localPath: config.wikiRepoPath || join(repoPath, '.wiki'),
      token: config.githubToken,
      defaultBranch: config.wikiRepoBranch,
      commitMessage: config.wikiCommitMessage,
      mode: config.wikiRepoMode,
      shallow: config.wikiRepoShallow,
    });

    await wikiWriter.writeDocumentation(allDocs);
    console.log(' GitHub wiki updated successfully');
  } else {
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
