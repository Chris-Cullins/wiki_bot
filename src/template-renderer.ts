import { readFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

interface RenderOptions {
  variant?: string;
  variantSubdir?: string;
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    const key = resolve(path);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export class TemplateRenderer {
  private readonly searchDirectories: string[];
  private readonly cache = new Map<string, string | null>();

  constructor(customDir?: string) {
    const selfDir = dirname(fileURLToPath(import.meta.url));
    const defaultDir = join(selfDir, 'templates');

    const directories = customDir ? [resolve(customDir), defaultDir] : [defaultDir];
    this.searchDirectories = uniquePaths(directories);
  }

  async render(
    templateName: string,
    context: Record<string, string>,
    options: RenderOptions = {},
  ): Promise<string> {
    const template = await this.loadTemplate(templateName, options);
    if (!template) {
      return context.content ?? '';
    }
    return this.interpolate(template, context);
  }

  private async loadTemplate(
    templateName: string,
    options: RenderOptions,
  ): Promise<string | undefined> {
    const cacheKey = this.buildCacheKey(templateName, options.variant);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return cached ?? undefined;
    }

    for (const directory of this.searchDirectories) {
      const candidates = this.buildCandidatePaths(directory, templateName, options);
      for (const candidate of candidates) {
        try {
          const content = await readFile(candidate, 'utf-8');
          this.cache.set(cacheKey, content);
          return content;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            continue;
          }
          console.warn(`⚠️  Failed to load template "${candidate}":`, error);
        }
      }
    }

    this.cache.set(cacheKey, null);
    return undefined;
  }

  private buildCandidatePaths(
    baseDir: string,
    templateName: string,
    options: RenderOptions,
  ): string[] {
    const candidates: string[] = [];

    if (options.variant && options.variantSubdir) {
      candidates.push(join(baseDir, options.variantSubdir, `${options.variant}.md`));
    }

    if (options.variant) {
      candidates.push(join(baseDir, `${templateName}-${options.variant}.md`));
      candidates.push(join(baseDir, `${options.variant}.md`));
    }

    candidates.push(join(baseDir, `${templateName}.md`));

    return candidates;
  }

  private buildCacheKey(templateName: string, variant?: string): string {
    return variant ? `${templateName}:${variant}` : templateName;
  }

  private interpolate(template: string, context: Record<string, string>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(context)) {
      const placeholder = new RegExp(`{{\s*${this.escapeRegExp(key)}\s*}}`, 'g');
      rendered = rendered.replace(placeholder, value ?? '');
    }
    return rendered;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
