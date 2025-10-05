import 'dotenv/config';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { loadConfig } from './config.js';
import { RepoCrawler } from './repo-crawler.js';
import { WikiGenerator } from './wiki-generator.js';

/**
 * Main entry point for the wiki bot application
 */
async function main() {
  // Load configuration
  const config = loadConfig();

  console.log('Initializing Wiki Bot...');
  console.log('Wiki Bot initialized successfully');

  // Determine the repository path
  const repoPath = config.repoPath || process.cwd();
  console.log(`Using repository path: ${repoPath}`);

  // Crawl the repository
  console.log('Crawling repository structure...');
  const crawler = new RepoCrawler();
  const repoStructure = await crawler.crawl(repoPath);
  const filePaths = crawler.getFilePaths(repoStructure);
  console.log(`Found ${filePaths.length} files in repository`);

  // Initialize wiki generator
  const wikiGenerator = new WikiGenerator(query, config);

  // Generate wiki documentation
  console.log('\nGenerating wiki documentation...');

  // Step 1: Generate Home page
  await wikiGenerator.generateHomePage(repoStructure);
  console.log('✓ Home page generated');

  // Step 2: Generate architectural overview
  await wikiGenerator.generateArchitecturalOverview(repoStructure);
  console.log('✓ Architectural overview generated');

  // TODO: Step 3: Loop through areas and generate detailed documentation
  // TODO: Implement CI integration mode
  // TODO: Implement documentation review mode

  console.log('\nWiki Bot completed successfully');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
