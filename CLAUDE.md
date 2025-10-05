# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wiki Bot is an AI-powered documentation generator that automatically creates comprehensive GitHub wiki documentation for codebases. It uses the Anthropic Claude Agent SDK to analyze repository structure and generate organized wiki pages.

## Common Commands

```bash
# Build the project
npm run build

# Run type checking
npm run type-check

# Run the bot (development mode with tsx)
npm run dev

# Run the bot (production mode)
npm start
```

## Environment Setup

Create a `.env` file based on `.env.example`:
- **Required**: `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` - API key for Claude Agent SDK
- **Optional**: `ANTHROPIC_BASE_URL` - Custom Anthropic API endpoint
- **Optional**: `REPO_PATH` - Path to repository to document (defaults to current working directory)
- **Optional**: `REPO_URL` - GitHub repository URL

## Architecture

### Core Components

**Entry Point (`src/index.ts`)**
- Orchestrates the entire wiki generation process
- Executes the multi-phase documentation workflow:
  1. Repository crawling
  2. Home page generation
  3. Architectural overview generation
  4. Architectural area extraction
  5. Per-area documentation generation

**Wiki Generator (`src/wiki-generator.ts`)**
- Central class that coordinates all documentation generation
- Uses Claude Agent SDK's `query` function to interact with Claude
- Each generation method:
  - Loads prompts from markdown files via `prompt-loader.ts`
  - Sends prompts to Claude via the Agent SDK
  - Streams and collects responses
- Key methods correspond to workflow phases:
  - `generateHomePage()` - Creates repository overview
  - `generateArchitecturalOverview()` - Analyzes architecture
  - `extractArchitecturalAreas()` - Parses JSON list of areas from Claude's response
  - `identifyRelevantFiles()` - Maps files to architectural areas
  - `generateAreaDocumentation()` - Creates detailed docs for each area

**Repo Crawler (`src/repo-crawler.ts`)**
- Recursively scans repository filesystem
- Builds hierarchical `FileNode` tree structure
- Ignores common build/dependency directories (node_modules, dist, .git, etc.)
- Provides flat file path lists for analysis

**Configuration (`src/config.ts`)**
- Loads environment variables
- Validates required API credentials

**Prompt System (`src/prompts/`)**
- Prompts are stored as markdown files in `src/prompts/`
- `prompt-loader.ts` loads prompts and injects variables using `{{variableName}}` syntax
- Each prompt file corresponds to a specific generation task
- This separation allows easy prompt iteration without code changes

### Data Flow

1. `RepoCrawler` scans repository → produces `FileNode` tree
2. `WikiGenerator.generateHomePage()` → formats tree → loads prompt → queries Claude → returns markdown
3. `WikiGenerator.generateArchitecturalOverview()` → same pattern for architecture analysis
4. `WikiGenerator.extractArchitecturalAreas()` → parses JSON array from Claude's response
5. For each area:
   - `WikiGenerator.identifyRelevantFiles()` → queries Claude to map files to area
   - `WikiGenerator.generateAreaDocumentation()` → reads file contents → generates area docs

### Current State

**Phase 1 (Complete)**: Core wiki generation
- Repository crawling
- Home page generation
- Architectural analysis
- Per-area documentation

**Phase 2 (TODO)**: Wiki persistence
- GitHub wiki API integration
- Documentation storage and updates

**Phase 3 (TODO)**: CI/CD integration
- Incremental documentation updates from git diffs
- PR documentation review gates
- Automated documentation quality checks

## Important Implementation Details

- Uses ES modules (`"type": "module"` in package.json)
- TypeScript with strict mode enabled
- All Claude interactions stream responses via async iteration
- Prompt template system uses `{{variableName}}` for variable injection
- File paths in `FileNode` tree are relative to repository root
