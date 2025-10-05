#!/bin/bash

# Test mode script for Wiki Bot
# This runs the wiki bot in test mode without making any API calls

echo "🧪 Running Wiki Bot in TEST MODE"
echo "=================================="
echo ""
echo "This will:"
echo "  ✓ Crawl the repository structure"
echo "  ✓ Generate mock wiki documentation"
echo "  ✓ Skip all Agent SDK API calls (saves money!)"
echo "  ✓ Write to wiki_bot's GitHub wiki"
echo ""

# Run with test mode enabled
# Using the wiki_bot repo's actual wiki for testing
TEST_MODE=true \
WIKI_REPO_URL=https://github.com/Chris-Cullins/wiki_bot.wiki.git \
WIKI_REPO_MODE=fresh \
npm start
