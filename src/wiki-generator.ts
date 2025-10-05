import type { Query } from '@anthropic-ai/claude-agent-sdk';
import type { FileNode } from './repo-crawler.js';
import type { Config } from './config.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

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

    const prompt = `You are a technical documentation expert. Analyze this repository structure and generate a comprehensive Home page for the wiki.

Repository Structure:
${structureText}

Please create a Home.md page that includes:
1. A clear project title and brief description (infer from the structure)
2. An overview of what this project does
3. Main features or capabilities (based on the file structure)
4. High-level architecture summary
5. Links to key documentation sections

The output should be in Markdown format and professional.`;

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

    const prompt = `You are a software architect analyzing a repository. Based on the structure below, identify and document the architectural patterns and main areas of the application.

Repository Structure:
${structureText}

Please create an Architecture.md page that includes:
1. Overall architectural pattern (e.g., MVC, microservices, layered, component-based)
2. Key directories and their purposes
3. Main architectural "slices" or areas (identify 3-7 distinct areas that developers would work in)
4. Component interactions and dependencies
5. Data flow and system boundaries

For the architectural slices, provide a list in this format:
## Architectural Areas
- **Area Name**: Brief description

The output should be in Markdown format and technical but accessible.`;

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
    const prompt = `Based on this architectural overview, extract a simple list of the main architectural areas or slices.

${architecturalOverview}

Please provide ONLY a JSON array of area names, nothing else. Example: ["Authentication", "Data Layer", "API Services"]`;

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
    } catch {
      console.warn('Failed to parse architectural areas, using fallback');
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

    const prompt = `You are analyzing a codebase. Given the architectural area "${area}", identify which files from the repository are most relevant to document this area.

Repository Structure:
${structureText}

All Files:
${allFiles.join('\n')}

Please provide ONLY a JSON array of file paths that are relevant to the "${area}" area. Include the most important files (limit to 10-15 files). Example: ["src/auth/login.ts", "src/auth/middleware.ts"]`;

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

    const prompt = `You are a technical documentation expert. Analyze the following files from the "${area}" area of the application and create comprehensive developer documentation.

Files in this area:
${fileContentText}

Please create a detailed documentation page that includes:
1. **Overview**: Purpose and responsibilities of this area
2. **Key Components**: Main files/classes and their roles
3. **How It Works**: Logical flow and important implementation details
4. **Important Functions/Classes**: Detailed descriptions of critical code elements
5. **Developer Notes**: Gotchas, best practices, and things to be aware of
6. **Usage Examples**: Where applicable, show how to use this area

The output should be in Markdown format, well-structured, and targeted at developers who need to understand or work with this code.`;

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
