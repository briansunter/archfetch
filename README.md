# arcfetch

[![npm version](https://badge.fury.io/js/arcfetch.svg)](https://www.npmjs.org/package/arcfetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Zero-config URL fetching** that converts web pages to clean markdown with automatic JavaScript rendering fallback.

Perfect for AI workflows, research, and documentation. Fetches URLs, extracts article content using Mozilla Readability, and caches as markdown with 90-95% token reduction.

## Why arcfetch?

| Problem | Solution |
|---------|----------|
| **JS-heavy sites return blank** | Auto-detects and retries with Playwright |
| **Too much HTML clutter** | Mozilla Readability extracts just the article |
| **High token costs for LLMs** | 90-95% token reduction vs raw HTML |
| **No good caching story** | Temp → Docs workflow for easy curation |
| **Hard to integrate** | Works as CLI or MCP server with zero setup |

## Features

- **Smart Fetching**: Simple HTTP first, automatic Playwright fallback for JS-heavy sites
- **Quality Gates**: Configurable quality thresholds (0-100) with automatic retry
- **Clean Markdown**: Mozilla Readability + Turndown for 90-95% token reduction
- **Temp → Docs Workflow**: Cache to temp folder, promote to docs when ready
- **CLI & MCP**: Available as command-line tool and MCP server
- **Multiple Output Formats**: Plain text, JSON, filepath, or summary
- **Configurable Thresholds**: Set quality minimums and retry strategies

## Quick Start

### No Installation Required (npx/bunx)

```bash
# Fetch and display markdown
npx arcfetch fetch https://example.com/article

# Get just the filepath (for scripts)
npx arcfetch fetch https://example.com -o path

# With pretty output
bunx arcfetch fetch https://example.com --pretty
```

### Global Installation

```bash
npm install -g arcfetch

# Then use directly
arcfetch fetch https://example.com/article
```

### Development

```bash
git clone https://github.com/yourusername/arcfetch.git
cd arcfetch
bun install
bun run cli.ts fetch https://example.com
```

## CLI Usage

### Basic Commands

```bash
# Fetch and display markdown (default output)
arcfetch fetch https://example.com/article

# List all cached references
arcfetch list

# Promote from temp to permanent docs
arcfetch promote REF-001

# Delete a cached reference
arcfetch delete REF-001

# Show current configuration
arcfetch config
```

### Output Formats

```bash
# Plain text (LLM-friendly, default)
arcfetch fetch https://example.com -o text

# Just the filepath (for scripts)
arcfetch fetch https://example.com -o path

# Summary: REF-ID|filepath
arcfetch fetch https://example.com -o summary

# Structured JSON
arcfetch fetch https://example.com -o json

# Human-friendly with emojis
arcfetch fetch https://example.com --pretty
```

### Advanced Options

```bash
# Add search query as metadata
arcfetch fetch https://example.com -q "machine learning"

# Set minimum quality threshold (default: 60)
arcfetch fetch https://example.com --min-quality 80

# Force Playwright (skip simple fetch)
arcfetch fetch https://example.com --force-playwright

# Use faster wait strategy for simple sites
arcfetch fetch https://example.com --wait-strategy load

# Custom directories
arcfetch fetch https://example.com --temp-dir .cache --docs-dir content

# Verbose output for debugging
arcfetch fetch https://example.com -v
```

## MCP Server

### Installation (Recommended: npx/bunx)

Add to your Claude Code MCP configuration (`~/.config/claude-code/mcp_config.json`):

```json
{
  "mcpServers": {
    "arcfetch": {
      "command": "npx",
      "args": ["arcfetch"]
    }
  }
}
```

Or using bunx (faster):

```json
{
  "mcpServers": {
    "arcfetch": {
      "command": "bunx",
      "args": ["arcfetch"]
    }
  }
}
```

### Local Development

```json
{
  "mcpServers": {
    "arcfetch": {
      "command": "bun",
      "args": ["run", "/path/to/arcfetch/index.ts"],
      "cwd": "/path/to/arcfetch"
    }
  }
}
```

### MCP Tools

| Tool | Parameters | Description |
|------|------------|-------------|
| `fetch_url` | `url`, `query?`, `minQuality?`, `forcePlaywright?` | Fetch URL with auto JS fallback |
| `list_cached` | - | List all cached references |
| `promote_reference` | `refId` | Move from temp to docs folder |
| `delete_cached` | `refId` | Delete a cached reference |

Example MCP usage:
```
User: Fetch https://example.com/article for me
Claude: [Calls fetch_url tool]
```

## Configuration

### Config File

Create `arcfetch.config.json` in your project root:

```json
{
  "quality": {
    "minScore": 60,
    "jsRetryThreshold": 85
  },
  "paths": {
    "tempDir": ".tmp",
    "docsDir": "docs/ai/references"
  },
  "playwright": {
    "timeout": 30000,
    "waitStrategy": "networkidle"
  }
}
```

### Environment Variables

```bash
ARCFETCH_MIN_SCORE=60
ARCFETCH_TEMP_DIR=.tmp
ARCFETCH_DOCS_DIR=docs/ai/references
```

## Quality Pipeline

```
URL → Simple Fetch → Quality Check
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
     Score ≥ 85      60-84           < 60
         │               │               │
         ▼               ▼               ▼
       Save        Try Playwright   Try Playwright
                   (if better)      (required)
                         │               │
                         ▼               ▼
                   Compare &       Score ≥ 60?
                   use best        Yes → Save
                                   No → Error
```

## Playwright Wait Strategies

| Strategy | Speed | Reliability | Best For |
|----------|-------|-------------|----------|
| `networkidle` | Slowest | Highest | JS-heavy apps, dynamic content |
| `domcontentloaded` | Medium | Medium | Most SPAs, modern sites |
| `load` | Fastest | Basic | Static sites, simple pages |

## Quality Pipeline

```
URL → Simple Fetch → Quality Check (0-100)
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
     Score ≥ 85      60-84           < 60
         │               │               │
         ▼               ▼               ▼
       Save        Try Playwright   Try Playwright
                   use best         Score ≥ 60?
                                    Yes → Save
                                    No → Error
```

**Default thresholds:**
- `minScore`: 60 - Content below this is rejected
- `jsRetryThreshold`: 85 - Above this, skip Playwright entirely

## Real-World Examples

### AI Research Workflow

```bash
# Fetch multiple articles for research
npx arcfetch fetch https://arxiv.org/abs/2301.00001 -q "LLM research"
npx arcfetch fetch https://openai.com/research/gpt-4 -q "GPT-4"

# List all fetched
npx arcfetch list

# Promote the best ones to docs
npx arcfetch promote REF-001
npx arcfetch promote REF-002
```

### Script Integration

```bash
#!/bin/bash
# fetch-and-process.sh

# Fetch and get filepath
filepath=$(npx arcfetch fetch https://example.com -o path)

# Process with other tools
cat "$filepath" | other-tool

# Or get just the ref ID
summary=$(npx arcfetch fetch https://example.com -o summary)
ref_id=$(echo "$summary" | cut -d'|' -f1)

# Promote if it meets quality standards
if npx arcfetch promote "$ref_id"; then
  echo "Successfully promoted $ref_id"
fi
```

### Handling JS-Heavy Sites

```bash
# Modern React/Vue/Angular apps
arcfetch fetch https://spa-example.com --force-playwright --wait-strategy networkidle

# Simple blogs (use faster strategy)
arcfetch fetch https://blog.example.com --wait-strategy load

# Unknown site (let arcfetch decide)
arcfetch fetch https://unknown-site.com
```

### Bulk Fetching with JSON Output

```bash
# Fetch multiple URLs and parse JSON
for url in "${urls[@]}"; do
  arcfetch fetch "$url" -o json >> results.json
done

# Or use jq to extract specific fields
arcfetch fetch https://example.com -o json | jq '.filepath'
```

## Troubleshooting

### "Playwright not found" Error

**Problem:** Playwright fails to launch

**Solution:**
```bash
# If using npm globally
npm install -g playwright

# If using npx (auto-installed)
npx arcfetch fetch https://example.com --force-playwright
```

### Low Quality Score

**Problem:** Content is rejected due to low quality

**Solution:**
```bash
# Lower the threshold temporarily
arcfetch fetch https://example.com --min-quality 40

# Or force Playwright (often produces better results)
arcfetch fetch https://example.com --force-playwright
```

### Timeout on Slow Sites

**Problem:** Site takes too long to load

**Solution:**
```bash
# Use faster wait strategy
arcfetch fetch https://example.com --wait-strategy load

# Combine with force-playwright for JS sites
arcfetch fetch https://example.com --force-playwright --wait-strategy domcontentloaded
```

### MCP Server Not Connecting

**Problem:** Claude Code can't connect to MCP server

**Solution:**
```bash
# Test if the MCP server works manually
npx arcfetch fetch https://example.com

# Check your MCP config path
# macOS: ~/.config/claude-code/mcp_config.json
# Linux: ~/.config/claude-code/mcp_config.json
# Windows: %APPDATA%\claude-code\mcp_config.json
```

## Comparison

| Feature | arcfetch | html-to-markdown | url-to-markdown | playwright-extra |
|---------|----------|------------------|-----------------|------------------|
| Auto JS fallback | ✅ | ❌ | ❌ | Manual |
| Quality scoring | ✅ | ❌ | ❌ | ❌ |
| Temp → Docs workflow | ✅ | ❌ | ❌ | ❌ |
| MCP server | ✅ | ❌ | ❌ | ❌ |
| Multiple output formats | ✅ | ❌ | Some | ❌ |
| Zero-config | ✅ | ✅ | ✅ | ❌ |
| Playwright included | ✅ | ❌ | ❌ | Manual setup |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLI / MCP Interface                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Core Pipeline                         │
│  1. Simple HTTP Fetch                                    │
│  2. Extract with Readability + Turndown                  │
│  3. Validate Quality Score                               │
│  4. Conditional Playwright Retry                         │
│  5. Cache with Frontmatter Metadata                      │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │   Cache   │  │Playwright │  │ Validator │
      │   Manager │  │  Manager  │  │           │
      └───────────┘  └───────────┘  └───────────┘
```

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to the main branch.

### Development Setup

```bash
git clone https://github.com/yourusername/arcfetch.git
cd arcfetch
bun install
bun test          # Run tests
bun run typecheck # Type checking
```

## License

MIT License - see LICENSE file for details
