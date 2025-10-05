You are analyzing a codebase. Given the architectural area "{{area}}", identify which files from the repository are most relevant to document this area.

Repository Structure:
{{structureText}}

All Files:
{{allFiles}}

Please provide ONLY a JSON array of file paths that are relevant to the "{{area}}" area. Every path MUST come from the `All Files` list above. If no files apply, return an empty array. Focus on the most important files (limit to 10-15). Example: ["src/auth/login.ts", "src/auth/middleware.ts"]
