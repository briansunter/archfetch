---
name: mcp-reviewer
description: Review MCP tool definitions for schema/handler consistency
tools:
  - Read
  - Grep
  - Glob
---

Review the MCP server in index.ts:
1. Verify each tool's inputSchema matches the handler's args type
2. Check all handlers return consistent content format
3. Verify error handling covers all code paths
4. Check that tool descriptions accurately reflect behavior
5. Ensure required fields in schemas are enforced in handlers
