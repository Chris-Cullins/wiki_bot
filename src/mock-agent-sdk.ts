import type { Query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Mock implementation of the Agent SDK query function for testing
 * Returns realistic fake responses without calling the actual API
 */
export function createMockQuery(): (params: { prompt: string; options?: any }) => Query {
  return function mockQuery({ prompt }: { prompt: string; options?: any }): Query {
    // Determine what type of prompt this is based on content
    const response = generateMockResponse(prompt);

    // Return an async iterator that yields the mock response
    return (async function* () {
      yield {
        type: 'assistant' as const,
        content: response,
      };
    })() as Query;
  };
}

/**
 * Generate appropriate mock response based on the prompt content
 */
function generateMockResponse(prompt: string): string {
  const promptLower = prompt.toLowerCase();

  // Extract architectural areas - return JSON array (CHECK THIS FIRST - most specific)
  // This prompt asks for ONLY a JSON array of area names
  if (promptLower.includes('please provide only a json array')) {
    return JSON.stringify([
      'Configuration Management',
      'Data Processing',
      'Storage Layer',
      'API Integration',
      'Utilities',
    ]);
  }

  // Home page generation
  if (promptLower.includes('home page') || promptLower.includes('repository overview')) {
    return `# Repository Overview

## About This Project

This is a software project with a well-organized structure designed for maintainability and scalability.

## Key Features

- Modern architecture with clear separation of concerns
- Comprehensive testing suite
- Well-documented codebase
- Active development and maintenance

## Project Structure

The project follows industry best practices with organized directories for source code, tests, configuration, and documentation.

## Getting Started

1. Clone the repository
2. Install dependencies
3. Run the development server
4. Explore the codebase

## Documentation

See the Architecture section for detailed information about the system design and implementation.
`;
  }

  // Architectural overview
  if (promptLower.includes('architectural') && promptLower.includes('overview')) {
    return `# Architectural Overview

## System Design

This application follows a modular architecture with clear separation between different layers and concerns.

## Key Architectural Areas

The system is organized into several key architectural areas:

1. **Configuration Management** - Handles application configuration and environment setup
2. **Data Processing** - Core business logic and data transformation
3. **Storage Layer** - Data persistence and retrieval mechanisms
4. **API Integration** - External service integrations and API clients
5. **Utilities** - Shared utility functions and helpers

## Design Patterns

The codebase employs several design patterns:
- Dependency Injection for loose coupling
- Factory patterns for object creation
- Strategy pattern for algorithm selection
- Repository pattern for data access

## Technology Stack

- TypeScript for type safety
- Node.js runtime environment
- Modern ES modules
- Comprehensive testing framework
`;
  }

  // Identify relevant files - return JSON array
  if (promptLower.includes('identify relevant files') || promptLower.includes('which files')) {
    // Extract the area name from the prompt
    const areaMatch = prompt.match(/area[:\s]+([^\n]+)/i);
    const area = areaMatch ? areaMatch[1].trim() : '';

    // Return mock file list based on area
    if (area.toLowerCase().includes('config')) {
      return JSON.stringify(['src/config.ts', 'src/index.ts', '.env.example']);
    } else if (area.toLowerCase().includes('storage')) {
      return JSON.stringify([
        'src/wiki-storage/github-wiki-writer.ts',
        'src/wiki-storage/git-repository-manager.ts',
      ]);
    } else if (area.toLowerCase().includes('data') || area.toLowerCase().includes('processing')) {
      return JSON.stringify([
        'src/wiki-generator.ts',
        'src/repo-crawler.ts',
        'src/prompts/prompt-loader.ts',
      ]);
    } else {
      return JSON.stringify(['src/index.ts', 'src/config.ts']);
    }
  }

  // Area documentation generation
  if (promptLower.includes('generate') && promptLower.includes('documentation')) {
    const areaMatch = prompt.match(/area[:\s]+([^\n]+)/i);
    const area = areaMatch ? areaMatch[1].trim() : 'Component';

    return `# ${area}

## Overview

The ${area} component provides essential functionality for the application's core operations.

## Key Components

This area includes several key components that work together to deliver the required functionality.

### Main Classes

- Primary implementation classes that handle the core logic
- Helper classes that provide supporting functionality
- Interface definitions for type safety

## Implementation Details

The implementation follows best practices with:
- Clear separation of concerns
- Comprehensive error handling
- Type-safe interfaces
- Thorough documentation

## Usage

\`\`\`typescript
// Example usage
import { Component } from './component';

const instance = new Component(options);
await instance.execute();
\`\`\`

## Design Decisions

Key architectural decisions include:
- Use of dependency injection for flexibility
- Async/await for asynchronous operations
- Strong typing with TypeScript

## Testing

This component includes comprehensive unit tests covering all major functionality.
`;
  }

  // Fallback response
  return `# Generated Documentation

This is a mock response generated in test mode. The actual Agent SDK was not called.

## Prompt Received

The system received a prompt and would normally process it with Claude, but test mode is enabled.

## Test Mode

Test mode allows you to test the application workflow without incurring API costs.
`;
}
