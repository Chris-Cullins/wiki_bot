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
  const homePage = await wikiGenerator.generateHomePage(repoStructure);
  console.log('✓ Home page generated');

  // Step 2: Generate architectural overview
  const archOverview = await wikiGenerator.generateArchitecturalOverview(repoStructure);
  console.log('✓ Architectural overview generated');

  // Step 3: Extract architectural areas
  const areas = await wikiGenerator.extractArchitecturalAreas(archOverview);
  console.log(`✓ Identified ${areas.length} architectural areas: ${areas.join(', ')}`);

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
      console.log(`  ✓ Documentation generated for ${area}`);
    } else {
      console.log(`  ⚠ No relevant files found for ${area}, skipping`);
    }
  }

  // Store all generated documentation
  const allDocs = new Map<string, string>([
    ['Home', homePage],
    ['Architecture', archOverview],
    ...areaDocumentation,
  ]);

  // TODO: Save documentation to wiki (Phase 2)
  // For now, just log what we generated
  console.log('\n📚 Generated Documentation Pages:');
  for (const [page, _content] of allDocs) {
    console.log(`  - ${page}`);
  }

  // TODO: Implement CI integration mode
  // TODO: Implement documentation review mode

  console.log('\nWiki Bot completed successfully');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
