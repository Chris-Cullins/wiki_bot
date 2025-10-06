import { mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export interface DebugLoggerOptions {
  enabled?: boolean;
  promptLoggingEnabled?: boolean;
  promptLogDir?: string;
}

export class DebugLogger {
  private readonly enabled: boolean;
  private readonly promptLoggingEnabled: boolean;
  private readonly promptLogDir?: string;
  private transcriptCounter = 0;

  constructor(options: boolean | DebugLoggerOptions) {
    if (typeof options === 'boolean') {
      this.enabled = options;
      this.promptLoggingEnabled = false;
      this.promptLogDir = undefined;
      return;
    }

    this.enabled = Boolean(options.enabled);
    this.promptLoggingEnabled = Boolean(options.promptLoggingEnabled && options.promptLogDir);

    if (this.promptLoggingEnabled && options.promptLogDir) {
      const runId = new Date().toISOString().replace(/[:.]/g, '-');
      const runDirectory = join(options.promptLogDir, runId);
      this.ensureDirectory(options.promptLogDir);
      this.ensureDirectory(runDirectory);
      this.promptLogDir = runDirectory;
      console.log(`⚙️  Prompt logging enabled at ${runDirectory}`);
    } else {
      this.promptLogDir = undefined;
    }
  }

  debug(message: string, ...details: unknown[]): void {
    if (!this.enabled) {
      return;
    }

    if (details.length === 0) {
      console.log(`⚙️  ${message}`);
      return;
    }

    console.log(`⚙️  ${message}`, ...details);
  }

  logPrompt(label: string, prompt: string): void {
    this.writeTranscript(label, 'prompt', prompt);
  }

  logResponse(label: string, response: string): void {
    this.writeTranscript(label, 'response', response);
  }

  private ensureDirectory(path: string): void {
    try {
      mkdirSync(path, { recursive: true });
    } catch (error) {
      console.warn('⚠️  Failed to prepare prompt log directory', { path, error });
    }
  }

  private writeTranscript(label: string, phase: 'prompt' | 'response', content: string): void {
    if (!this.promptLoggingEnabled || !this.promptLogDir) {
      return;
    }

    const normalizedLabel = label
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entry';

    const index = `${this.transcriptCounter}`.padStart(4, '0');
    this.transcriptCounter += 1;

    const filePath = join(this.promptLogDir, `${index}-${normalizedLabel}-${phase}.md`);
    void writeFile(filePath, content, 'utf-8').catch((error) => {
      console.warn('⚠️  Failed to write prompt transcript', { filePath, error });
    });
  }
}
