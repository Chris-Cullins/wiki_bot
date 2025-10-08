# Wiki Bot

An AI-powered documentation generator that automatically creates comprehensive GitHub wiki documentation for codebases using the Anthropic Claude Agent SDK.

For more details on how the code works see [The Wiki](https://github.com/Chris-Cullins/wiki_bot/wiki) (Yes it wrote them)

## Features

- **Automated Documentation Generation**: Analyzes your codebase and generates structured wiki pages
- **Architectural Analysis**: Identifies key architectural areas and patterns in your code
- **Intelligent File Mapping**: Maps source files to relevant documentation sections
- **Multi-Phase Workflow**: Systematic approach to creating comprehensive documentation
- **Streaming Responses**: Real-time documentation generation using Claude's streaming API
- **Flexible LLM Providers**: Default to the Anthropic Agent SDK or run via local Claude/Codex CLIs to manage usage
- **Debug Transcripts**: Optional prompt/response capture for deep troubleshooting
- **Custom Templates**: Drop-in Markdown templates to control page layout per section

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

### Env. Arguments
```bash
# Anthropic API credentials
ANTHROPIC_API_KEY=your_api_key_here
# Optional: Custom API endpoint
ANTHROPIC_BASE_URL=https://api.anthropic.com

# Can use a local install of Claude Code or Codex-CLI instead, So you can use your subscription
LLM_PROVIDER=claude-cli # or codex-cli

# Verbose logging for troubleshooting
DEBUG=false
# Persist full prompt/response transcripts for debugging
PROMPT_LOG_ENABLED=false
# Override transcript output directory
PROMPT_LOG_DIR=.wiki-logs
# Documentation depth (summary | standard | deep)
DOC_DEPTH=standard
# Provide custom Markdown templates for generated pages
TEMPLATE_DIR=./src/templates
# Remove existing wiki markdown files when WIKI_REPO_MODE=fresh
WIKI_FRESH_CLEAN=false

# Repository to document (defaults to current working directory)
REPO_PATH=/path/to/your/repository

# GitHub repository URL
REPO_URL=https://github.com/username/repo
```

When using the CLI adapters, make sure the corresponding binary is installed, authenticated, and available on `PATH`. The bot pipes each prompt through the tool once and captures the response, so interactive sessions are not supported.

### Selective Regeneration

Target a specific source file to refresh only the affected documentation:

```bash
npm run dev -- --target-file src/wiki-generator.ts
```

You can also override the per-run documentation depth with `--depth summary|standard|deep`.


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

## License

MIT
