# Wiki Repository Management Improvements

## Overview

The wiki repository management system has been redesigned to address several critical issues with better state handling, cleaner separation of concerns, and more flexible configuration options.

## Problems Solved

### 1. **Destructive Repository Updates**
- **Before**: Used `git reset --hard` on every run, destroying local changes
- **After**: Proper status checking with warnings for uncommitted changes

### 2. **No State Management**
- **Before**: No tracking of repository state (clean/dirty, ahead/behind)
- **After**: Full repository status tracking with `RepositoryStatus` interface

### 3. **Poor Separation of Concerns**
- **Before**: Git operations mixed with file writing logic
- **After**: Dedicated `GitRepositoryManager` class for all git operations

### 4. **Inflexible Clone/Update Strategy**
- **Before**: Always clone or hard reset
- **After**: Three configurable modes: `fresh`, `incremental`, `reuse-or-clone`

### 5. **Performance Issues**
- **Before**: Full clones every time
- **After**: Optional shallow clones for faster setup

## New Architecture

### GitRepositoryManager (`src/wiki-storage/git-repository-manager.ts`)

A dedicated class for managing git repository operations with proper state handling:

```typescript
// Repository modes
type RepositoryMode = 'fresh' | 'incremental' | 'reuse-or-clone';

// Fresh mode: Always clone fresh, removing existing repo
// Incremental mode: Reuse if exists and pull latest, else clone
// Reuse-or-clone mode: Use existing as-is, or clone if missing
```

**Key Features:**
- Status tracking (clean/dirty, ahead/behind remote)
- Safe update operations (checks for uncommitted changes)
- Proper branch management
- Credential sanitization in error messages
- Support for shallow clones

**Methods:**
- `prepare()` - Prepares repository based on configured mode
- `status()` - Returns detailed repository status
- `clone()` - Clones repository with optional shallow clone
- `update()` - Safely updates to latest remote state
- `commit(message)` - Creates commit if changes exist
- `push()` - Pushes commits to remote
- `clean()` - Removes local repository

### Updated GitHubWikiWriter

Refactored to use `GitRepositoryManager` instead of managing git operations directly:

**Improvements:**
- Cleaner code with git operations delegated to manager
- Better error handling and user warnings
- Status checking before operations
- Removed duplicate git execution code

### Configuration Updates

New environment variables in `.env.example`:

```bash
# Repository management mode (defaults to 'incremental')
WIKI_REPO_MODE=incremental

# Use shallow clone for faster setup (defaults to false)
WIKI_REPO_SHALLOW=true
```

**Modes Explained:**

1. **`fresh`** - Always start clean
   - Removes existing local wiki
   - Clones fresh from remote
   - Use when: You want guaranteed clean state every run

2. **`incremental`** (default) - Smart reuse with updates
   - Reuses existing wiki if present
   - Pulls latest changes from remote
   - Clones if not present
   - Use when: Normal operation, want latest changes

3. **`reuse-or-clone`** - Maximum reuse
   - Uses existing wiki as-is without pulling
   - Only clones if not present
   - Use when: Working offline or want to keep local changes

## TypeScript Configuration

Fixed `tsconfig.json` to include Node.js types:

```json
{
  "compilerOptions": {
    "types": ["node"],
    // ... other options
  }
}
```

## Usage Examples

### Default Behavior (Incremental)
```bash
# Reuses existing wiki and pulls latest changes
npm start
```

### Fresh Clone Every Time
```bash
# Always starts with clean slate
WIKI_REPO_MODE=fresh npm start
```

### Fast Initial Setup
```bash
# Uses shallow clone for faster first run
WIKI_REPO_SHALLOW=true npm start
```

### Working Offline
```bash
# Reuses existing wiki without pulling
WIKI_REPO_MODE=reuse-or-clone npm start
```

## Migration Guide

### For Existing Users

No breaking changes - default behavior is similar to before but safer:

1. **Environment variables** - All existing env vars still work
2. **New optional vars** - `WIKI_REPO_MODE` and `WIKI_REPO_SHALLOW` are optional
3. **Behavior change** - Will now warn instead of silently destroying uncommitted changes

### API Changes

If you're using `GitHubWikiWriter` programmatically:

```typescript
// Before
const writer = new GitHubWikiWriter({
  wikiRepoUrl: '...',
  localPath: '...',
  token: '...',
});

// After (with new options)
const writer = new GitHubWikiWriter({
  wikiRepoUrl: '...',
  localPath: '...',
  token: '...',
  mode: 'incremental',  // Optional: fresh, incremental, reuse-or-clone
  shallow: true,        // Optional: use shallow clone
});
```

## Benefits

1. **Safer Operations** - No more silent data loss
2. **Better Performance** - Shallow clones, smart reuse
3. **More Flexible** - Multiple modes for different use cases
4. **Better Errors** - Clear status and error messages
5. **Cleaner Code** - Proper separation of concerns
6. **Type Safety** - Full TypeScript support with proper types

## Testing

All changes have been validated:
- ✅ Type checking passes (`npm run type-check`)
- ✅ Build succeeds (`npm run build`)
- ✅ No breaking changes to existing API
- ✅ Backward compatible with existing configuration

## Files Changed

- `src/wiki-storage/git-repository-manager.ts` - **NEW** repository manager
- `src/wiki-storage/github-wiki-writer.ts` - Refactored to use manager
- `src/config.ts` - Added new configuration options
- `src/index.ts` - Pass new options to writer
- `.env.example` - Document new environment variables
- `tsconfig.json` - Fix Node.js types configuration
