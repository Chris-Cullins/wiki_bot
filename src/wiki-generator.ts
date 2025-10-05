import type {
  Query,
  SDKAssistantMessage,
  SDKPartialAssistantMessage,
} from '@anthropic-ai/claude-agent-sdk';
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

  private async collectResponseText(query: Query): Promise<string> {
    let streamText = '';
    let assistantText = '';
    let mockText = '';

    for await (const message of query) {
      if (this.isMockAssistantMessage(message)) {
        mockText += message.content;
        continue;
      }

      if (this.isStreamEventMessage(message)) {
        streamText += this.extractTextFromStreamEvent(message.event);
        continue;
      }

      if (this.isSDKAssistantMessage(message)) {
        assistantText += this.extractTextFromContentBlocks(message.message?.content);
        continue;
      }
    }

    if (streamText.trim().length > 0) {
      return streamText;
    }

    if (assistantText.trim().length > 0) {
      return assistantText;
    }

    return mockText;
  }

  private isMockAssistantMessage(message: unknown): message is { type: 'assistant'; content: string } {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'assistant' &&
      typeof (message as { content?: unknown }).content === 'string'
    );
  }

  private isSDKAssistantMessage(message: unknown): message is SDKAssistantMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'assistant' &&
      typeof (message as { message?: unknown }).message === 'object'
    );
  }

  private isStreamEventMessage(message: unknown): message is SDKPartialAssistantMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'stream_event' &&
      typeof (message as { event?: unknown }).event === 'object'
    );
  }

  private extractTextFromContentBlocks(content: unknown): string {
    if (!Array.isArray(content)) {
      return '';
    }

    let text = '';
    for (const block of content) {
      if (this.isTextBlock(block)) {
        text += block.text;
      }
    }

    return text;
  }

  private extractTextFromStreamEvent(event: unknown): string {
    if (typeof event !== 'object' || event === null) {
      return '';
    }

    const eventType = (event as { type?: unknown }).type;

    if (eventType === 'content_block_delta') {
      const delta = (event as { delta?: unknown }).delta;
      if (this.isTextDelta(delta)) {
        return delta.text;
      }
    }

    if (eventType === 'content_block_start') {
      const contentBlock = (event as { content_block?: unknown }).content_block;
      if (Array.isArray(contentBlock)) {
        return this.extractTextFromContentBlocks(contentBlock);
      }
      if (contentBlock) {
        return this.extractTextFromContentBlocks([contentBlock]);
      }
    }

    return '';
  }

  private isTextBlock(block: unknown): block is { type: 'text'; text: string } {
    return (
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: unknown }).type === 'text' &&
      typeof (block as { text?: unknown }).text === 'string'
    );
  }

  private isTextDelta(delta: unknown): delta is { type: 'text_delta'; text: string } {
    return (
      typeof delta === 'object' &&
      delta !== null &&
      (delta as { type?: unknown }).type === 'text_delta' &&
      typeof (delta as { text?: unknown }).text === 'string'
    );
  }

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

    const response = await this.collectResponseText(query);

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

    const response = await this.collectResponseText(query);

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

    const response = await this.collectResponseText(query);

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

    const response = await this.collectResponseText(query);

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

    const response = await this.collectResponseText(query);

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
