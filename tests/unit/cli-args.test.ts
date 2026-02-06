import { describe, expect, test } from 'bun:test';
import { parseArgs } from '../../cli';

function withArgs(args: string[]) {
  const original = process.argv;
  process.argv = ['bun', 'cli.ts', ...args];
  try {
    return parseArgs();
  } finally {
    process.argv = original;
  }
}

describe('parseArgs', () => {
  describe('commands', () => {
    test('returns help when no arguments', () => {
      const result = withArgs([]);
      expect(result.command).toBe('help');
    });

    test('parses fetch command with URL', () => {
      const result = withArgs(['fetch', 'https://example.com']);
      expect(result.command).toBe('fetch');
      expect(result.args).toEqual(['https://example.com']);
    });

    test('parses list command', () => {
      const result = withArgs(['list']);
      expect(result.command).toBe('list');
      expect(result.args).toEqual([]);
    });

    test('parses promote command with ref-id', () => {
      const result = withArgs(['promote', 'my-article']);
      expect(result.command).toBe('promote');
      expect(result.args).toEqual(['my-article']);
    });

    test('parses delete command with ref-id', () => {
      const result = withArgs(['delete', 'my-article']);
      expect(result.command).toBe('delete');
      expect(result.args).toEqual(['my-article']);
    });

    test('parses links command with ref-id', () => {
      const result = withArgs(['links', 'my-article']);
      expect(result.command).toBe('links');
      expect(result.args).toEqual(['my-article']);
    });

    test('parses fetch-links command with ref-id', () => {
      const result = withArgs(['fetch-links', 'my-article']);
      expect(result.command).toBe('fetch-links');
      expect(result.args).toEqual(['my-article']);
    });

    test('parses config command', () => {
      const result = withArgs(['config']);
      expect(result.command).toBe('config');
    });

    test('parses mcp command', () => {
      const result = withArgs(['mcp']);
      expect(result.command).toBe('mcp');
    });
  });

  describe('options', () => {
    test('parses -o json', () => {
      const result = withArgs(['fetch', 'https://example.com', '-o', 'json']);
      expect(result.options.output).toBe('json');
    });

    test('parses --output summary', () => {
      const result = withArgs(['fetch', 'https://example.com', '--output', 'summary']);
      expect(result.options.output).toBe('summary');
    });

    test('parses -o path', () => {
      const result = withArgs(['fetch', 'https://example.com', '-o', 'path']);
      expect(result.options.output).toBe('path');
    });

    test('parses --verbose flag', () => {
      const result = withArgs(['fetch', 'https://example.com', '--verbose']);
      expect(result.options.verbose).toBe(true);
    });

    test('parses -v flag', () => {
      const result = withArgs(['fetch', 'https://example.com', '-v']);
      expect(result.options.verbose).toBe(true);
    });

    test('parses --pretty flag', () => {
      const result = withArgs(['fetch', 'https://example.com', '--pretty']);
      expect(result.options.pretty).toBe(true);
    });

    test('parses --refetch flag', () => {
      const result = withArgs(['fetch', 'https://example.com', '--refetch']);
      expect(result.options.refetch).toBe(true);
    });

    test('parses -q / --query', () => {
      const result = withArgs(['fetch', 'https://example.com', '-q', 'search term']);
      expect(result.options.query).toBe('search term');
    });

    test('parses --query', () => {
      const result = withArgs(['fetch', 'https://example.com', '--query', 'search term']);
      expect(result.options.query).toBe('search term');
    });

    test('parses --min-quality', () => {
      const result = withArgs(['fetch', 'https://example.com', '--min-quality', '80']);
      expect(result.options.minQuality).toBe(80);
    });

    test('parses --temp-dir', () => {
      const result = withArgs(['fetch', 'https://example.com', '--temp-dir', '/custom/tmp']);
      expect(result.options.tempDir).toBe('/custom/tmp');
    });

    test('parses --docs-dir', () => {
      const result = withArgs(['fetch', 'https://example.com', '--docs-dir', '/custom/docs']);
      expect(result.options.docsDir).toBe('/custom/docs');
    });

    test('parses --wait-strategy networkidle', () => {
      const result = withArgs(['fetch', 'https://example.com', '--wait-strategy', 'networkidle']);
      expect(result.options.waitStrategy).toBe('networkidle');
    });

    test('parses --wait-strategy domcontentloaded', () => {
      const result = withArgs(['fetch', 'https://example.com', '--wait-strategy', 'domcontentloaded']);
      expect(result.options.waitStrategy).toBe('domcontentloaded');
    });

    test('parses --wait-strategy load', () => {
      const result = withArgs(['fetch', 'https://example.com', '--wait-strategy', 'load']);
      expect(result.options.waitStrategy).toBe('load');
    });

    test('parses --force-playwright', () => {
      const result = withArgs(['fetch', 'https://example.com', '--force-playwright']);
      expect(result.options.forcePlaywright).toBe(true);
    });

    test('-h as option on a command returns help', () => {
      const result = withArgs(['fetch', '-h']);
      expect(result.command).toBe('help');
    });

    test('--help as option on a command returns help', () => {
      const result = withArgs(['fetch', '--help']);
      expect(result.command).toBe('help');
    });
  });

  describe('defaults', () => {
    test('has correct default values', () => {
      const result = withArgs(['fetch', 'https://example.com']);
      expect(result.options.output).toBe('text');
      expect(result.options.verbose).toBe(false);
      expect(result.options.pretty).toBe(false);
      expect(result.options.refetch).toBe(false);
      expect(result.options.query).toBeUndefined();
      expect(result.options.minQuality).toBeUndefined();
      expect(result.options.tempDir).toBeUndefined();
      expect(result.options.docsDir).toBeUndefined();
      expect(result.options.waitStrategy).toBeUndefined();
      expect(result.options.forcePlaywright).toBeUndefined();
    });
  });

  describe('multiple options', () => {
    test('parses multiple options together', () => {
      const result = withArgs([
        'fetch',
        'https://example.com',
        '-o',
        'json',
        '--verbose',
        '--refetch',
        '-q',
        'test query',
        '--min-quality',
        '90',
        '--force-playwright',
      ]);
      expect(result.command).toBe('fetch');
      expect(result.args).toEqual(['https://example.com']);
      expect(result.options.output).toBe('json');
      expect(result.options.verbose).toBe(true);
      expect(result.options.refetch).toBe(true);
      expect(result.options.query).toBe('test query');
      expect(result.options.minQuality).toBe(90);
      expect(result.options.forcePlaywright).toBe(true);
    });
  });
});
