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
echo "  ✓ Optionally write to wiki repo (if configured)"
echo ""

# Run with test mode enabled
TEST_MODE=true npm start
