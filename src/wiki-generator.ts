import type { Query } from '@anthropic-ai/claude-agent-sdk';
import type { FileNode } from './repo-crawler.js';
import type { Config } from './config.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { loadPrompt } from './prompts/prompt-loader.js';

/**
 * Generates wiki documentation for a repository
 */
export class WikiGenerator {
  constructor(
    private _query: (params: { prompt: string; options?: any }) => Query,
    private _config: Config
  ) {}

  /**
   * Convert FileNode tree to a readable string representation
   */
  private formatRepoStructure(node: FileNode, indent = ''): string {
    let result = `${indent}${node.name}${node.type === 'directory' ? '/' : ''}\n`;

    if (node.children) {
      for (const child of node.children) {
        result += this.formatRepoStructure(child, indent + '  ');
      }
    }

    return result;
  }

  /**
   * Generate the Home page for the wiki
   */
  async generateHomePage(repoStructure: FileNode): Promise<string> {
    console.log('Generating home page...');

    const structureText = this.formatRepoStructure(repoStructure);
    const prompt = await loadPrompt('generate-home-page', { structureText });

    const query = this._query({
      prompt,
      options: {
        apiKey: this._config.apiKey,
        baseURL: this._config.baseURL,
      },
    });

    // Collect the response from the agent
    let response = '';
    for await (const message of query) {
      if (message.type === 'assistant' && 'content' in message) {
        response += message.content;
      }
    }

    return response || '# Repository Overview\n\nUnable to generate home page.';
  }

  /**
   * Analyze and document the architectural slices of the application
   */
  async generateArchitecturalOverview(repoStructure: FileNode): Promise<string> {
    console.log('Generating architectural overview...');

    const structureText = this.formatRepoStructure(repoStructure);
    const prompt = await loadPrompt('generate-architectural-overview', { structureText });

    const query = this._query({
      prompt,
      options: {
        apiKey: this._config.apiKey,
        baseURL: this._config.baseURL,
      },
    });

    // Collect the response from the agent
    let response = '';
    for await (const message of query) {
      if (message.type === 'assistant' && 'content' in message) {
        response += message.content;
      }
    }

    return response || '# Architectural Overview\n\nUnable to generate architectural overview.';
  }

  /**
   * Extract architectural areas from the generated overview
   */
  async extractArchitecturalAreas(architecturalOverview: string): Promise<string[]> {
    const prompt = await loadPrompt('extract-architectural-areas', { architecturalOverview });

    const query = this._query({
      prompt,
      options: {
        apiKey: this._config.apiKey,
        baseURL: this._config.baseURL,
      },
    });

    let response = '';
    for await (const message of query) {
      if (message.type === 'assistant' && 'content' in message) {
        response += message.content;
      }
    }

    try {
      const areas = JSON.parse(response);
      return Array.isArray(areas) ? areas : [];
    } catch (error) {
      console.warn('Failed to parse architectural areas, using fallback');
      console.warn('Response was:', response.substring(0, 200));
      return [];
    }
  }

  /**
   * Identify which files belong to a specific architectural area
   */
  async identifyRelevantFiles(
    area: string,
    allFiles: string[],
    repoStructure: FileNode,
  ): Promise<string[]> {
    const structureText = this.formatRepoStructure(repoStructure);
    const prompt = await loadPrompt('identify-relevant-files', {
      area,
      structureText,
      allFiles: allFiles.join('\n'),
    });

    const query = this._query({
      prompt,
      options: {
        apiKey: this._config.apiKey,
        baseURL: this._config.baseURL,
      },
    });

    let response = '';
    for await (const message of query) {
      if (message.type === 'assistant' && 'content' in message) {
        response += message.content;
      }
    }

    try {
      const files = JSON.parse(response);
      return Array.isArray(files) ? files : [];
    } catch {
      console.warn(`Failed to parse relevant files for area "${area}"`);
      return [];
    }
  }

  /**
   * Read file contents for analysis
   */
  private async readFileContents(
    repoPath: string,
    filePaths: string[],
  ): Promise<Map<string, string>> {
    const fileContents = new Map<string, string>();

    for (const filePath of filePaths) {
      try {
        const fullPath = join(repoPath, filePath);
        const content = await readFile(fullPath, 'utf-8');
        fileContents.set(filePath, content);
      } catch (error) {
        console.warn(`Failed to read file ${filePath}:`, error);
      }
    }

    return fileContents;
  }

  /**
   * Generate documentation for a specific area of the application
   */
  async generateAreaDocumentation(
    area: string,
    relevantFiles: string[],
  ): Promise<string> {
    console.log(`Generating documentation for area: ${area}`);

    const repoPath = this._config.repoPath || process.cwd();
    const fileContents = await this.readFileContents(repoPath, relevantFiles);

    // Format file contents for the prompt
    let fileContentText = '';
    for (const [filePath, content] of fileContents) {
      fileContentText += `\n--- ${filePath} ---\n${content}\n`;
    }

    const prompt = await loadPrompt('generate-area-documentation', {
      area,
      fileContentText,
    });

    const query = this._query({
      prompt,
      options: {
        apiKey: this._config.apiKey,
        baseURL: this._config.baseURL,
      },
    });

    let response = '';
    for await (const message of query) {
      if (message.type === 'assistant' && 'content' in message) {
        response += message.content;
      }
    }

    return response || `# ${area}\n\nUnable to generate documentation for this area.`;
  }

  /**
   * Update existing wiki documentation based on a git diff
   */
  async updateDocumentationFromDiff(
    _diff: string,
    existingDocs: Map<string, string>,
  ): Promise<Map<string, string>> {
    // TODO: Use the query function to analyze the diff and update relevant docs
    console.log('Updating documentation from git diff...');
    return existingDocs;
  }

  /**
   * Review a PR's documentation changes and provide a pass/fail gate
   */
  async reviewDocumentation(
    _diff: string,
    _docChanges: Map<string, string>,
  ): Promise<{ pass: boolean; feedback: string }> {
    // TODO: Use the query function to review documentation quality
    console.log('Reviewing documentation...');
    return {
      pass: true,
      feedback: 'Documentation review not yet implemented',
    };
  }
}
