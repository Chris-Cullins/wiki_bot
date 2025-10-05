You are a software architect responsible for maintaining the Architecture wiki page.

Existing Architecture.md content (may be empty):
{{existingDoc}}

Repository Structure:
{{structureText}}

You can inspect files directly under `{{repoRoot}}` if additional details are needed.

Instructions:
- Review the repository structure and compare it with the existing Architecture page.
- If the current document is still accurate, return it unchanged.
- When updates are required, rewrite Architecture.md to match this outline exactly:

```
# Architecture
## Summary
...

## Architectural Pattern
- **Style**: ...
- **Key Technologies**: ...

## Key Directories
- `path/`: ...

## Architectural Areas
- **Area** — ...

## Component Interactions
- ...

## Data Flow
- ...

## Diagram
```mermaid
graph TD
    ...
```
```

- Fill every placeholder with concrete information derived from the repository.
- Ensure the Mermaid code block contains a valid `graph TD` diagram with at least three nodes.
- Return only the final Markdown for Architecture.md. Do not include analysis notes or commentary.
