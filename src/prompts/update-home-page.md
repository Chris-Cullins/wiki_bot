You are a technical documentation expert tasked with keeping the repository Home page accurate.

Existing Home.md content (may be empty):
{{existingDoc}}

Repository Structure:
{{structureText}}

Reference files under `{{repoRoot}}` as needed to refresh the content.

Instructions:
- Carefully compare the repository structure with the existing Home page.
- If the current Home page is still accurate, return it unchanged.
- When updates are required, rewrite the page to match this outline exactly:

```
# Home
## Project Snapshot
...

## Key Features
- ...

## Architecture Highlights
- ...

## Important Directories
- `path/`: ...

## Getting Started
### Prerequisites
- ...

### Setup
1. ...

## Documentation Links
- [...](...)
```

- Replace every placeholder with concrete information derived from the repository.
- Always return only the final Markdown for Home.md with no commentary or explanations.
