# Agent Operations Guide

## Mission
- Automate creation and upkeep of GitHub wikis for code repositories.
- Use the Anthropic Claude Agent SDK to understand repository structure, derive architecture insights, and produce documentation drafts.
- Iterate on documentation quality across multiple runs and support CI-driven documentation reviews.

## Platform Overview
- TypeScript application running on Node.js.
- Uses ES modules and strict TypeScript settings.
- Communicates with Claude through the Agent SDK (`query`) by default, with optional CLI wrappers for Claude Code (`LLM_PROVIDER=claude-cli`) or Codex (`LLM_PROVIDER=codex-cli`).
- Discovers repository context with a filesystem crawler that produces a `FileNode` tree while ignoring generated artifacts (`node_modules`, `dist`, `.git`, etc.).

## Core Workflow
1. **Repository Crawl**: `RepoCrawler` scans the target repo and emits a hierarchical and flat view of files.
2. **Home Page Generation**: `WikiGenerator.generateHomePage()` loads the repository overview prompt, calls Claude via the SDK, and persists the streamed markdown.
3. **Architecture Overview**: `generateArchitecturalOverview()` invokes Claude to summarize architectural slices using prompt templates.
4. **Architectural Area Extraction**: `extractArchitecturalAreas()` parses Claude's JSON response to enumerate focus areas.
5. **File Relevance Mapping**: `identifyRelevantFiles()` consults Claude to map files to each architectural area.
6. **Area Documentation**: `generateAreaDocumentation()` gathers source snippets, feeds prompts to Claude, and composes per-area wiki entries.
7. **Iterative Refinement (Planned)**: Future runs enhance existing pages, update wikis based on git diffs, and gate PRs on documentation quality.

## Execution Commands
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

## Configuration
- API access is required via `ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY` unless using the Codex CLI provider.
- Optional overrides:
  - `ANTHROPIC_BASE_URL` for custom endpoints.
  - `REPO_PATH` to target a specific local repository (defaults to CWD).
  - `REPO_URL` for the canonical GitHub location.
  - `DEBUG=true` to emit detailed prompt/response logging during execution.
- Environment variables can be exported directly or stored in a `.env` derived from `.env.example`.

## Roadmap
- **Phase 1 (Complete)**: Core wiki generation—crawling, home page, architecture summary, and per-area docs.
- **Phase 2 (Planned)**: Persist docs to GitHub wikis and manage updates.
- **Phase 3 (Planned)**: CI/CD integration for incremental updates, documentation review gates, and automated quality checks.
