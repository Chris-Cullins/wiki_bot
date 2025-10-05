# Wiki Bot Development Backlog

This document tracks all pending features and improvements for the wiki bot application.

## Phase 1: Core Wiki Generation ✅

### 1.1 Implement Home Page Generation
**File:** `src/wiki-generator.ts:32-68`
**Status:** ✅ COMPLETE

Implement the `generateHomePage()` method to use the Claude Agent SDK query function to analyze the repository structure and generate a comprehensive home page for the wiki.

**What's needed:**
- Use the `query` function to send a prompt with the repository structure
- Analyze the file tree to understand the project's purpose and structure
- Generate a markdown home page that includes:
  - Project overview and description
  - Main features/capabilities
  - High-level architecture summary
  - Links to other documentation sections

---

### 1.2 Implement Architectural Overview Generation
**File:** `src/wiki-generator.ts:73-114`
**Status:** ✅ COMPLETE

Implement the `generateArchitecturalOverview()` method to identify and document the architectural slices of the application.

**What's needed:**
- Use the `query` function to analyze the repository structure
- Identify architectural patterns (e.g., MVC, microservices, layers)
- Detect main components/modules and their relationships
- Generate a markdown page documenting:
  - Overall architecture pattern
  - Key directories and their purposes
  - Component interactions and dependencies
  - Data flow and system boundaries

---

### 1.3 Implement Area-Specific Documentation
**File:** `src/wiki-generator.ts:216-262`
**Status:** ✅ COMPLETE

Implement the `generateAreaDocumentation()` method to document specific areas of the application.

**What's needed:**
- Use the `query` function with the area name and relevant file paths
- Read and analyze the actual file contents for the given area
- Generate detailed documentation including:
  - Purpose and responsibilities of this area
  - Key files and their roles
  - Important functions/classes and their behavior
  - Developer notes (gotchas, best practices, etc.)
  - Usage examples where appropriate

---

### 1.4 Implement Iterative Documentation Loop
**File:** `src/index.ts:34-82`
**Status:** ✅ COMPLETE

Implement the main loop that works through each area of the application and generates detailed documentation.

**What's needed:**
- After generating the architectural overview, identify distinct "areas" to document
- Create a loop that iterates through each area
- For each area:
  - Identify relevant files from the repo structure
  - Call `generateAreaDocumentation()` for that area
  - Store/save the generated documentation
- Implement logic to run N iterations based on repo size
- Add refinement capability to improve existing docs in subsequent runs

---

## Phase 2: Wiki Storage and Output

### 2.1 Implement GitHub Wiki Writer
**Status:** TODO

Create functionality to write generated documentation to a GitHub wiki.

**What's needed:**
- Research GitHub wiki API or git-based approach
- Implement a `GitHubWikiWriter` class that can:
  - Clone/access the wiki repository
  - Create/update wiki pages
  - Commit and push changes
- Handle authentication (GitHub tokens)
- Create appropriate page structure and navigation

---

### 2.2 Add Alternative Wiki Storage Options
**Status:** TODO (Future)

Support other wiki formats beyond GitHub wikis.

**What's needed:**
- Design an abstract `WikiWriter` interface
- Implement support for:
  - Local markdown files
  - GitLab wikis
  - Confluence
  - Other documentation platforms
- Make storage backend configurable via environment variables

---

## Phase 3: CI/CD Integration

### 3.1 Implement CI Integration Mode
**File:** `src/index.ts:43`
**Status:** TODO

Add a mode that runs in CI to automatically update documentation when PRs are created.

**What's needed:**
- Add command-line arguments to specify different modes (initial, ci, review)
- Implement git diff analysis:
  - Get the diff for the current PR/branch
  - Identify which files changed
- Implement `updateDocumentationFromDiff()` method:
  - Use the `query` function to analyze the diff
  - Determine which wiki pages are affected by changes
  - Update relevant documentation sections
- Commit documentation updates back to the PR branch
- Handle edge cases (new files, deleted files, refactoring)

---

### 3.2 Implement Documentation Update from Diff
**File:** `src/wiki-generator.ts:51`
**Status:** TODO

Implement the `updateDocumentationFromDiff()` method to intelligently update docs based on code changes.

**What's needed:**
- Use the `query` function to analyze git diff output
- Parse the diff to understand what changed
- Load existing wiki documentation
- For each affected area:
  - Identify which documentation sections need updates
  - Generate updated content that reflects the changes
  - Preserve unchanged documentation
- Return updated documentation map

---

### 3.3 Implement Documentation Review Mode
**File:** `src/index.ts:44`
**Status:** TODO

Add a documentation review mode that provides pass/fail gates for PRs.

**What's needed:**
- Implement command-line mode for review
- Extract PR diff and documentation changes
- Implement `reviewDocumentation()` method to:
  - Use the `query` function to review doc quality
  - Check if code changes are adequately documented
  - Verify documentation accuracy
  - Check for completeness
- Generate detailed feedback report
- Return pass/fail status with specific issues
- Exit with appropriate status code for CI integration

---

### 3.4 Implement Documentation Quality Review
**File:** `src/wiki-generator.ts:63`
**Status:** TODO

Implement the `reviewDocumentation()` method to assess documentation quality.

**What's needed:**
- Use the `query` function to analyze both diff and doc changes
- Evaluate documentation against criteria:
  - Completeness (all changes documented)
  - Accuracy (docs match code changes)
  - Clarity (docs are understandable)
  - Examples (where appropriate)
- Generate actionable feedback
- Return pass/fail with detailed reasoning

---

## Phase 4: Enhancements and Polish

### 4.1 Add Configuration for Repo Size Scaling
**Status:** TODO

Implement logic to scale documentation iterations based on repository size.

**What's needed:**
- Analyze repository metrics (file count, LOC, complexity)
- Define thresholds for small/medium/large repos
- Configure number of refinement iterations per size
- Make this configurable via environment variables

---

### 4.2 Improve Repository Crawler
**Status:** TODO

Enhance the repository crawler with better filtering and analysis.

**What's needed:**
- Add configuration for custom ignore patterns
- Detect programming languages and file types
- Estimate code complexity
- Identify important vs. auxiliary files
- Support .gitignore parsing

---

### 4.3 Add Progress Tracking and Logging
**Status:** TODO

Implement better visibility into the wiki generation process.

**What's needed:**
- Add structured logging (e.g., winston, pino)
- Implement progress bars for long operations
- Add timing metrics
- Create summary reports of what was generated
- Add debug mode for troubleshooting

---

### 4.4 Add Error Handling and Retry Logic
**Status:** TODO

Improve robustness with better error handling.

**What's needed:**
- Add try-catch blocks around SDK calls
- Implement retry logic for transient failures
- Handle rate limiting gracefully
- Provide meaningful error messages
- Add recovery mechanisms for partial failures

---

### 4.5 Add Tests
**Status:** TODO

Create test coverage for the application.

**What's needed:**
- Set up testing framework (Jest or Vitest)
- Unit tests for:
  - RepoCrawler
  - Config loading
  - WikiGenerator methods (with mocked SDK)
- Integration tests for the full workflow
- Add test fixtures (sample repos)
- Set up CI to run tests

---

## Notes

- Items are roughly ordered by priority within each phase
- Phase 1 should be completed before moving to Phase 2
- Phases 2 and 3 can be developed in parallel
- Phase 4 can be tackled incrementally alongside other work
