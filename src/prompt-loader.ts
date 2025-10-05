import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load a prompt from a markdown file and inject variables
 */
export async function loadPrompt(
  promptName: string,
  variables: Record<string, string> = {},
): Promise<string> {
  const promptPath = join(__dirname, 'prompts', `${promptName}.md`);
  let prompt = await readFile(promptPath, 'utf-8');

  // Replace variables in the format {{variableName}}
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
  }

  return prompt;
}
