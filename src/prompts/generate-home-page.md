You are a technical documentation expert. Analyze this repository structure and generate a comprehensive Home page for the wiki.

Repository Structure:
{{structureText}}

You have direct filesystem access to the repository root at `{{repoRoot}}`. Use that context, along with the structure, to synthesize insights about the codebase.

Produce Markdown that matches this outline exactly:

```
# Home
## Project Snapshot
<2-3 sentence overview of the project purpose, domain, and tech stack>

## Key Features
- <bullet one sentence>
- <bullet one sentence>
- <add 3-5 bullets total>

## Architecture Highlights
- <1-2 bullet summary of top-level patterns>
- <reference major subsystems>

## Important Directories
- `path/`: <concise description of what lives here>
- `path/`: <concise description>
- <include 4-6 entries total>

## Getting Started
### Prerequisites
- <list tools or environment requirements>

### Setup
1. <step-by-step instructions informed by repo contents>
2. <include build/test commands>

## Documentation Links
- [Architecture](Architecture.md) – <what readers find there>
- <link to any other generated pages when relevant>
```

Output requirements:
- Return only the finished Markdown for `Home.md` following the outline above.
- Do not include analysis notes, tool instructions, or commentary about what you are doing.
- Do not ask for permission or mention writing files.
- Keep the tone professional and concise.
- Summarize the repository in paragraphs and bullet lists; never dump raw directory listings.
- Highlight the most important directories and files with context about their role.
