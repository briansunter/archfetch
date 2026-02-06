---
name: test-analyzer
description: Analyze test coverage gaps in the arcfetch pipeline
tools:
  - Read
  - Grep
  - Glob
  - Bash
---

Analyze test coverage:
1. Run `bun test --coverage` and review output
2. Identify untested branches in pipeline.ts quality thresholds
3. Check cache.ts edge cases (duplicate URLs, slug collisions, refetch paths)
4. Verify Playwright fallback paths are tested
5. Check link extraction and fetch_links error handling coverage
