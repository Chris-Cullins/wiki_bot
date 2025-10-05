import { spawn } from 'child_process';
import { query as agentQuery } from '@anthropic-ai/claude-agent-sdk';
import type { Query } from '@anthropic-ai/claude-agent-sdk';
import type { Config } from '../config.js';
import { createMockQuery } from '../mock-agent-sdk.js';

export type QueryFunction = (params: { prompt: string; options?: any }) => Query;

export function createQueryFunction(config: Config): QueryFunction {
  if (config.testMode) {
    return createMockQuery();
  }

  switch (config.llmProvider) {
    case 'claude-cli':
      return createClaudeCliQuery();
    case 'codex-cli':
      return createCodexCliQuery();
    case 'agent-sdk':
    default:
      return agentQuery;
  }
}

function createClaudeCliQuery(): QueryFunction {
  return ({ prompt }: { prompt: string; options?: any }) => {
    const iterator = (async function* () {
      const { stdout } = await runCommand('claude', ['-p'], prompt);
      yield {
        type: 'assistant' as const,
        content: stdout.trimEnd(),
      };
    })();

    return iterator as Query;
  };
}

function createCodexCliQuery(): QueryFunction {
  return ({ prompt }: { prompt: string; options?: any }) => {
    const iterator = (async function* () {
      const { stdout } = await runCommand('codex', ['exec', '--json', '-'], prompt);
      const message = extractCodexResponse(stdout);
      yield {
        type: 'assistant' as const,
        content: message,
      };
    })();

    return iterator as Query;
  };
}

async function runCommand(
  command: string,
  args: string[],
  input: string,
): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return reject(new Error(`Command "${command}" not found. Ensure it is installed and on the PATH.`));
      }
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const trimmedError = stderr.trim();
        const message = trimmedError
          ? `${command} exited with code ${code}: ${trimmedError}`
          : `${command} exited with code ${code}`;
        return reject(new Error(message));
      }
      resolve({ stdout, stderr });
    });

    child.stdin.setDefaultEncoding('utf8');
    child.stdin.end(input);
  });
}

function extractCodexResponse(output: string): string {
  const lines = output.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const messages: string[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as unknown;
      if (typeof parsed !== 'object' || parsed === null) {
        continue;
      }
      const message = (parsed as { msg?: unknown }).msg;
      if (typeof message !== 'object' || message === null) {
        continue;
      }
      const type = (message as { type?: unknown }).type;
      if (type === 'agent_message') {
        const text = (message as { message?: unknown }).message;
        if (typeof text === 'string' && text.trim().length > 0) {
          messages.push(text.trimEnd());
        }
      }
    } catch (_error) {
      continue; // Skip lines that are not valid JSON
    }
  }

  if (messages.length === 0) {
    throw new Error('codex exec did not return any agent_message output');
  }

  return messages.join('\n\n');
}
