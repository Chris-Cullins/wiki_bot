You are a technical documentation expert. Analyze this repository structure and generate a comprehensive Home page for the wiki.

Repository Structure:
{{structureText}}

You have direct filesystem access to the repository root at `{{repoRoot}}`. Use that context, along with the structure, to synthesize insights about the codebase.

Please create a Home.md page that includes:
1. A clear project title and brief description (infer from the structure)
2. An overview of what this project does
3. Main features or capabilities (based on the file structure)
4. High-level architecture summary
5. Links to key documentation sections

Output requirements:
- Return only the finished Markdown for `Home.md`.
- Do not include analysis notes, tool instructions, or commentary about what you are doing.
- Do not ask for permission or mention writing files.
- Keep the tone professional and concise.
- Summarize the repository in paragraphs and bullet lists; avoid dumping raw directory listings.
- Highlight the most important directories and files with context about their role.
