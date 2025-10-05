# W.I.P - Still tweaking the quality of the output

# Wiki Bot

An AI-powered documentation generator that automatically creates comprehensive GitHub wiki documentation for codebases using the Anthropic Claude Agent SDK.

## Features

- **Automated Documentation Generation**: Analyzes your codebase and generates structured wiki pages
- **Architectural Analysis**: Identifies key architectural areas and patterns in your code
- **Intelligent File Mapping**: Maps source files to relevant documentation sections
- **Multi-Phase Workflow**: Systematic approach to creating comprehensive documentation
- **Streaming Responses**: Real-time documentation generation using Claude's streaming API
- **Flexible LLM Providers**: Default to the Anthropic Agent SDK or run via local Claude/Codex CLIs to manage usage

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd wiki_bot

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

Create a `.env` file in the project root:

```bash
# Required: Anthropic API credentials
ANTHROPIC_AUTH_TOKEN=your_api_token_here
# or
ANTHROPIC_API_KEY=your_api_key_here

# Optional: Custom API endpoint
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Optional: Choose a local CLI provider (default: agent-sdk)
LLM_PROVIDER=claude-cli # or codex-cli

# Optional: Repository to document (defaults to current working directory)
REPO_PATH=/path/to/your/repository

# Optional: GitHub repository URL
REPO_URL=https://github.com/username/repo
```

Copy `.env.example` as a template:

```bash
cp .env.example .env
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Type Checking

```bash
npm run type-check
```

### Switching LLM Providers

Set `LLM_PROVIDER` to choose which backend executes prompts:

```bash
# Anthropic Agent SDK (default)
export LLM_PROVIDER=agent-sdk

# Claude CLI wrapper (uses `claude -p` under the hood)
export LLM_PROVIDER=claude-cli

# Codex CLI wrapper (streams JSON from `codex exec --json -`)
export LLM_PROVIDER=codex-cli
```

When using the CLI adapters, make sure the corresponding binary is installed, authenticated, and available on `PATH`. The bot pipes each prompt through the tool once and captures the response, so interactive sessions are not supported.

## How It Works

Wiki Bot follows a multi-phase workflow:

1. **Repository Crawling**: Recursively scans your codebase to build a complete file tree
2. **Home Page Generation**: Creates an overview of your repository
3. **Architectural Analysis**: Identifies key architectural patterns and areas
4. **Area Extraction**: Parses and organizes architectural components
5. **Detailed Documentation**: Generates in-depth documentation for each architectural area

## Architecture

### Core Components

- **`src/index.ts`**: Entry point that orchestrates the documentation workflow
- **`src/wiki-generator.ts`**: Central class coordinating all documentation generation using Claude Agent SDK
- **`src/repo-crawler.ts`**: Filesystem scanner that builds hierarchical repository structure
- **`src/prompt-loader.ts`**: Template system for loading and injecting variables into prompts
- **`src/prompts/`**: Markdown files containing prompts for each generation task
- **`src/config.ts`**: Environment configuration and validation

### Prompt System

Prompts are stored as markdown files in `src/prompts/` and use a template syntax with `{{variableName}}` for variable injection. This separation allows easy iteration on prompts without code changes.

## Project Status

### Phase 1 ✅ (Complete)
- Core wiki generation
- Repository crawling
- Home page generation
- Architectural analysis
- Per-area documentation

### Phase 2 🚧 (TODO)
- GitHub wiki API integration
- Documentation storage and updates

### Phase 3 🚧 (TODO)
- CI/CD integration
- Incremental updates from git diffs
- PR documentation review gates
- Automated quality checks

## Technology Stack

- **TypeScript**: Strict mode enabled for type safety
- **Claude Agent SDK**: AI-powered documentation generation
- **ES Modules**: Modern JavaScript module system
- **Node.js**: Runtime environment

## License

MIT
