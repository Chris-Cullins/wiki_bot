import type {
  Query,
  SDKAssistantMessage,
  SDKPartialAssistantMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { FileNode } from './repo-crawler.js';
import type { Config, DocumentationDepth } from './config.js';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { loadPrompt } from './prompt-loader.js';
import { DebugLogger } from './logging.js';
import { TemplateRenderer } from './template-renderer.js';

const DEFAULT_MERMAID_BODY = `\`\`\`mermaid\ngraph TD\n    ComponentA[Component A] --> ComponentB[Component B]\n    ComponentB --> ComponentC[Component C]\n\`\`\``;

/**
 * Generates wiki documentation for a repository
 */
export class WikiGenerator {
  private readonly _logger: DebugLogger;
  private readonly _depth: DocumentationDepth;
  private readonly _templates: TemplateRenderer;

  constructor(
    private _query: (params: { prompt: string; options?: any }) => Query,
    private _config: Config,
    logger?: DebugLogger,
  ) {
    this._logger =
      logger ??
      new DebugLogger({
        enabled: Boolean(_config.debug),
        promptLoggingEnabled: _config.promptLoggingEnabled,
        promptLogDir: _config.promptLogDir,
      });
    this._depth = _config.documentationDepth ?? 'standard';
    this._templates = new TemplateRenderer(_config.templateDir);
  }

  private createQuery(prompt: string): Query {
    this._logger.debug('Dispatching query', {
      promptPreview: prompt.slice(0, 200),
    });
    return this._query({
      prompt,
      options: {
        apiKey: this._config.apiKey,
        baseURL: this._config.baseURL,
        systemPrompt: { type: 'preset', preset: 'claude_code' },
      },
    });
  }

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

    const finalText = streamText.trim().length > 0
      ? streamText
      : assistantText.trim().length > 0
        ? assistantText
        : mockText;

    this._logger.debug('Collected response text', {
      preview: finalText.slice(0, 200),
    });

    return finalText;
  }

  private stripFenceWrappers(content: string): string {
    const trimmed = content.trim();

    const firstFence = trimmed.indexOf('```');
    if (firstFence === 0) {
      const afterFence = trimmed.slice(firstFence + 3);
      const newlineIndex = afterFence.indexOf('\n');
      let start = firstFence + 3;
      if (newlineIndex !== -1) {
        const language = afterFence.slice(0, newlineIndex).trim();
        if (/^[a-zA-Z0-9+-]*$/.test(language)) {
          start = firstFence + 3 + newlineIndex + 1;
        }
      }
      const closingFence = trimmed.lastIndexOf('```');
      if (closingFence > start) {
        const inner = trimmed.slice(start, closingFence).trim();
        if (inner.length > 0) {
          return this.stripLeadingCommentary(inner);
        }
      }
    }

    return this.stripLeadingCommentary(trimmed);
  }

  private ensureHeading(content: string, title: string): string {
    const trimmed = content.trim();
    if (!trimmed) {
      return `# ${title}`;
    }

    const normalizedTitle = title.trim().replace(/\s+/g, ' ').toLowerCase();
    const lines = trimmed.split(/\r?\n/);
    const firstLine = lines[0]?.trim() ?? '';

    const headingMatch = firstLine.match(/^(#+)\s+(.*)$/);
    if (headingMatch) {
      const [, _hashes, text] = headingMatch;
      const normalizedHeading = text.trim().replace(/\s+/g, ' ').toLowerCase();
      if (normalizedHeading === normalizedTitle) {
        return trimmed;
      }

      lines[0] = `## ${text.trim()}`;
      return `# ${title}\n\n${lines.join('\n')}`.trim();
    }

    return `# ${title}\n\n${trimmed}`;
  }

  private stripLeadingCommentary(content: string): string {
    const headingIndex = content.search(/(^|\n)\s*#/);
    if (headingIndex > 0) {
      const normalizedHeadingIndex = content.indexOf('#', headingIndex);
      if (normalizedHeadingIndex !== -1) {
        return content.slice(normalizedHeadingIndex).trim();
      }
    }
    return content;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private slugify(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  }

  private hasMeaningfulBody(content: string, title: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) {
      return false;
    }

    const lines = trimmed.split(/\r?\n/);
    if (lines.length === 0) {
      return false;
    }

    let bodyStart = 0;
    const headingMatch = lines[0]?.match(/^(#+)\s+(.*)$/);
    if (headingMatch) {
      const normalizedHeading = headingMatch[2].trim().toLowerCase();
      const normalizedTitle = title.trim().toLowerCase();
      if (normalizedHeading === normalizedTitle) {
        bodyStart = 1;
      }
    }

    for (let index = bodyStart; index < lines.length; index += 1) {
      if (lines[index].trim().length > 0) {
        return true;
      }
    }

    return false;
  }

  private isMetaDescription(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) {
      return false;
    }

    const paragraph = trimmed.split(/\r?\n\s*\r?\n/, 1)[0]?.toLowerCase() ?? '';

    if (!paragraph) {
      return false;
    }

    const metaTriggers = [
      /i['’]ve\s+(created|provided|assembled|prepared)\b.*\b(doc|documentation|wiki)/i,
      /i\s+have\s+(created|provided|assembled|prepared)\b.*\b(doc|documentation|wiki)/i,
      /this\s+(documentation|doc|wiki)\s+(includes|covers|contains)/i,
      /the\s+(documentation|doc|wiki)\s+(includes|covers|contains)/i,
    ];

    return metaTriggers.some((pattern) => pattern.test(paragraph));
  }

  private ensureSection(content: string, heading: string, fallbackBody: string): string {
    const escapedHeading = this.escapeRegExp(heading);
    const pattern = new RegExp(`^##\\s+${escapedHeading}\\b`, 'm');
    if (pattern.test(content)) {
      return content;
    }
    return `${content.trim()}\n\n## ${heading}\n${fallbackBody.trim()}\n`;
  }

  private removeSection(content: string, heading: string): string {
    const escapedHeading = this.escapeRegExp(heading);
    const pattern = new RegExp(`(?:^|\n)##\s+${escapedHeading}\b[\s\S]*?(?=(?:\n##\s+)|$)`, 'i');
    return content.replace(pattern, '\n').trim();
  }

  private ensureArchitectureOutline(content: string): string {
    let normalized = content.trim();
    if (!/^#\s+Architecture\b/m.test(normalized)) {
      normalized = `# Architecture\n\n${normalized}`;
    }

    normalized = this.ensureSection(normalized, 'Summary', '_TODO: Provide an architectural summary._');
    normalized = this.ensureSection(
      normalized,
      'Architectural Pattern',
      '- **Style**: TODO\n- **Key Technologies**: TODO',
    );
    normalized = this.ensureSection(normalized, 'Key Directories', '- `src/`: TODO');
    normalized = this.ensureSection(normalized, 'Architectural Areas', '- **Area** — TODO');
    normalized = this.ensureSection(normalized, 'Component Interactions', '- TODO');
    normalized = this.ensureSection(normalized, 'Data Flow', '- TODO');

    let mermaidBlock: string | undefined;
    const fencedMermaid = normalized.match(/```mermaid[\s\S]*?```/i);
    if (fencedMermaid) {
      mermaidBlock = fencedMermaid[0].trim();
      normalized = normalized.replace(/```mermaid[\s\S]*?```/gi, '').trim();
    } else {
      const strayMermaid = normalized.match(/(^|\n)(graph\s+TD[\s\S]*?)(?=(?:\n##\s+)|$)/i);
      if (strayMermaid) {
        const prefix = strayMermaid[1];
        const body = strayMermaid[2].trim();
        mermaidBlock = `\`\`\`mermaid\n${body}\n\`\`\``;
        normalized = normalized.replace(strayMermaid[0], prefix).trim();
      }
    }

    normalized = this.removeSection(normalized, 'Diagram');
    if (!mermaidBlock) {
      mermaidBlock = DEFAULT_MERMAID_BODY;
    }

    return `${normalized}\n\n## Diagram\n\n${mermaidBlock}\n`.trim();
  }

  private getDepthInstruction(): string {
    switch (this._depth) {
      case 'summary':
        return 'Keep the documentation concise and high-level. Focus on purpose, main responsibilities, and how this area is used. Skip deep implementation walk-throughs.';
      case 'deep':
        return 'Provide exhaustive detail that helps maintainers. Explain control flow, important helpers, rationale for design choices, and include illustrative examples or edge cases.';
      default:
        return 'Offer a balanced level of detail suitable for experienced engineers. Explain responsibilities, primary workflows, and key call-outs without overwhelming minutiae.';
    }
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
  async generateHomePage(repoStructure: FileNode, existingDoc?: string): Promise<string> {
    console.log('Generating home page...');

    const structureText = this.formatRepoStructure(repoStructure);
    const repoRoot = this._config.repoPath ? resolve(this._config.repoPath) : process.cwd();
    const useIncremental = this._config.incrementalDocs && existingDoc !== undefined;
    const promptName = useIncremental ? 'update-home-page' : 'generate-home-page';
    const prompt = await loadPrompt(promptName, {
      structureText,
      existingDoc: existingDoc ?? '',
      repoRoot,
    });

    this._logger.debug('Loaded home page prompt', {
      promptName,
      length: prompt.length,
      preview: prompt.slice(0, 200),
    });

    this._logger.logPrompt('home-page', prompt);

    const query = this.createQuery(prompt);

    const rawResponse = await this.collectResponseText(query);
    this._logger.logResponse('home-page', rawResponse);
    const response = this.stripFenceWrappers(rawResponse);
    this._logger.debug('Home page raw response', {
      preview: rawResponse.slice(0, 200),
    });
    const withHeading = this.ensureHeading(response, 'Home');
    if (!this.hasMeaningfulBody(withHeading, 'Home')) {
      if (existingDoc && existingDoc.trim().length > 0) {
        this._logger.debug('Home page generation returned no new content, reusing existing page');
        return existingDoc;
      }
      return '# Home\n\nUnable to generate home page.';
    }
    const templated = await this._templates.render('home', {
      title: 'Home',
      content: withHeading,
      depth: this._depth,
    });
    this._logger.debug('Generated home page content', {
      preview: templated.slice(0, 200),
    });

    if (!this.hasMeaningfulBody(templated, 'Home')) {
      if (existingDoc && existingDoc.trim().length > 0) {
        this._logger.debug('Templated home page was empty after rendering, reusing existing page');
        return existingDoc;
      }
      return '# Home\n\nUnable to generate home page.';
    }

    return templated;
  }

  /**
   * Analyze and document the architectural slices of the application
   */
  async generateArchitecturalOverview(
    repoStructure: FileNode,
    existingDoc?: string,
  ): Promise<string> {
    console.log('Generating architectural overview...');

    const structureText = this.formatRepoStructure(repoStructure);
    const repoRoot = this._config.repoPath ? resolve(this._config.repoPath) : process.cwd();
    const useIncremental = this._config.incrementalDocs && existingDoc !== undefined;
    const promptName = useIncremental
      ? 'update-architectural-overview'
      : 'generate-architectural-overview';
    const prompt = await loadPrompt(promptName, {
      structureText,
      existingDoc: existingDoc ?? '',
      repoRoot,
    });

    this._logger.debug('Loaded architecture prompt', {
      promptName,
      length: prompt.length,
      preview: prompt.slice(0, 200),
    });

    this._logger.logPrompt('architecture-overview', prompt);

    const query = this.createQuery(prompt);

    const rawResponse = await this.collectResponseText(query);
    this._logger.logResponse('architecture-overview', rawResponse);
    const response = this.stripFenceWrappers(rawResponse);
    this._logger.debug('Architecture raw response', {
      preview: rawResponse.slice(0, 200),
    });
    const withHeading = this.ensureHeading(response, 'Architecture');
    const normalized = this.ensureArchitectureOutline(withHeading);
    if (!this.hasMeaningfulBody(normalized, 'Architecture')) {
      if (existingDoc && existingDoc.trim().length > 0) {
        this._logger.debug('Architecture generation produced no new content, reusing existing page');
        return existingDoc;
      }
      return '# Architecture\n\nUnable to generate architectural overview.';
    }
    const templated = await this._templates.render('architecture', {
      title: 'Architecture',
      content: normalized,
      depth: this._depth,
    });
    this._logger.debug('Generated architecture content', {
      preview: templated.slice(0, 200),
    });

    if (!this.hasMeaningfulBody(templated, 'Architecture')) {
      if (existingDoc && existingDoc.trim().length > 0) {
        this._logger.debug('Architecture generation returned no content, reusing existing page');
        return existingDoc;
      }
      return '# Architecture\n\nUnable to generate architectural overview.';
    }

    return templated;
  }

  /**
   * Extract architectural areas from the generated overview
   */
  async extractArchitecturalAreas(architecturalOverview: string): Promise<string[]> {
    const prompt = await loadPrompt('extract-architectural-areas', { architecturalOverview });
    this._logger.debug('Loaded extract-areas prompt', {
      length: prompt.length,
      preview: prompt.slice(0, 200),
    });

    this._logger.logPrompt('extract-areas', prompt);

    const query = this.createQuery(prompt);

    const rawResponse = await this.collectResponseText(query);
    this._logger.logResponse('extract-areas', rawResponse);
    const response = this.stripFenceWrappers(rawResponse);
    this._logger.debug('Architectural areas raw response', {
      preview: rawResponse.slice(0, 200),
    });

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

    this._logger.debug('Loaded relevant-files prompt', {
      area,
      length: prompt.length,
      preview: prompt.slice(0, 200),
    });

    this._logger.logPrompt(`identify-files-${area}`, prompt);

    const query = this.createQuery(prompt);

    const rawResponse = await this.collectResponseText(query);
    this._logger.logResponse(`identify-files-${area}`, rawResponse);
    const response = this.stripFenceWrappers(rawResponse);
    this._logger.debug('Relevant files raw response', {
      area,
      preview: rawResponse.slice(0, 200),
    });

    try {
      const files = JSON.parse(response);
      if (!Array.isArray(files)) {
        return [];
      }

      const knownFiles = new Set(allFiles);
      const seen = new Set<string>();
      const relevant: string[] = [];

      for (const entry of files) {
        if (typeof entry !== 'string') {
          continue;
        }
        if (!knownFiles.has(entry)) {
          console.warn(
            `Ignoring non-existent file path "${entry}" for area "${area}"`,
          );
          continue;
        }
        if (seen.has(entry)) {
          continue;
        }
        seen.add(entry);
        relevant.push(entry);
      }

      this._logger.debug('Resolved relevant files', {
        area,
        count: relevant.length,
        sample: relevant.slice(0, 5),
      });
      return relevant;
    } catch {
      console.warn(`Failed to parse relevant files for area "${area}"`);
      this._logger.debug('Failed to parse relevant files response', {
        area,
        responsePreview: response.slice(0, 200),
      });
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
        this._logger.debug('Read file for area documentation', {
          filePath,
          length: content.length,
        });
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
    existingDoc?: string,
  ): Promise<string> {
    console.log(`Generating documentation for area: ${area}`);

    const repoPath = this._config.repoPath ? resolve(this._config.repoPath) : process.cwd();
    const fileContents = await this.readFileContents(repoPath, relevantFiles);

    // Format file contents for the prompt
    let fileContentText = '';
    for (const [filePath, content] of fileContents) {
      fileContentText += `\n--- ${filePath} ---\n${content}\n`;
    }

    const promptName = this._config.incrementalDocs && existingDoc !== undefined
      ? 'update-area-documentation'
      : 'generate-area-documentation';
    const prompt = await loadPrompt(promptName, {
      area,
      fileContentText,
      existingDoc: existingDoc ?? '',
      depthInstruction: this.getDepthInstruction(),
    });

    this._logger.debug('Loaded area documentation prompt', {
      area,
      promptName,
      length: prompt.length,
      preview: prompt.slice(0, 200),
    });

    this._logger.logPrompt(`area-${area}`, prompt);

    const query = this.createQuery(prompt);

    const rawResponse = await this.collectResponseText(query);
    this._logger.logResponse(`area-${area}`, rawResponse);
    const response = this.stripFenceWrappers(rawResponse);
    this._logger.debug('Area documentation raw response', {
      area,
      preview: rawResponse.slice(0, 200),
    });
    const withHeading = this.ensureHeading(response, area);
    if (this.isMetaDescription(withHeading)) {
      this._logger.debug('Area documentation appears meta-descriptive', {
        area,
      });
      if (existingDoc && existingDoc.trim().length > 0 && !this.isMetaDescription(existingDoc)) {
        this._logger.debug('Reusing prior non-meta content for area', { area });
        return existingDoc;
      }
      return `# ${area}\n\nUnable to generate documentation for this area.`;
    }
    if (!this.hasMeaningfulBody(withHeading, area)) {
      if (existingDoc && existingDoc.trim().length > 0) {
        this._logger.debug('Area documentation had no new content, reusing existing page', {
          area,
        });
        return existingDoc;
      }
      return `# ${area}\n\nUnable to generate documentation for this area.`;
    }
    const templated = await this._templates.render(
      'area',
      {
        title: area,
        area,
        content: withHeading,
        depth: this._depth,
      },
      {
        variant: this.slugify(area),
        variantSubdir: 'areas',
      },
    );
    if (this.isMetaDescription(templated)) {
      this._logger.debug('Templated area documentation remained meta-descriptive', {
        area,
      });
      if (existingDoc && existingDoc.trim().length > 0 && !this.isMetaDescription(existingDoc)) {
        this._logger.debug('Reusing prior non-meta content for area after templating', { area });
        return existingDoc;
      }
      return `# ${area}\n\nUnable to generate documentation for this area.`;
    }
    if (!this.hasMeaningfulBody(templated, area)) {
      if (existingDoc && existingDoc.trim().length > 0) {
        this._logger.debug('Templated area documentation was empty, reusing existing page', {
          area,
        });
        return existingDoc;
      }
      return `# ${area}\n\nUnable to generate documentation for this area.`;
    }

    return templated;
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
