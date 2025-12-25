import { describe, expect, test } from 'bun:test';
import { validateMarkdown, formatValidationReport } from '../../src/utils/markdown-validator.js';

describe('markdown-validator', () => {
  describe('validateMarkdown', () => {
    test('returns perfect score for clean markdown', () => {
      const cleanMarkdown = `# Article Title

This is a well-formatted article with plenty of content to analyze.
It contains multiple paragraphs of meaningful text that should pass
all quality checks without any issues.

## Section One

Here is more content in this section. The article continues with
additional paragraphs that provide substantial text content for the
quality validator to evaluate.

## Section Two

Another section with more text content. This ensures the content
length is above the threshold for a full article.
`;
      const result = validateMarkdown(cleanMarkdown);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(100);
      expect(result.issues).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('detects excessive HTML tags (>100 tags)', () => {
      const htmlHeavy = 'text '.repeat(50) + '<div>test</div>'.repeat(101);
      const result = validateMarkdown(htmlHeavy);

      expect(result.score).toBeLessThanOrEqual(60);
      expect(result.issues.some((i) => i.includes('leftover HTML tags'))).toBe(true);
    });

    test('detects moderate HTML tags (>50 tags)', () => {
      // Use self-closing tags to get exactly 55 tags (not 110)
      const moderateHtml = 'text '.repeat(100) + '<br/>'.repeat(55);
      const result = validateMarkdown(moderateHtml);

      expect(result.score).toBeLessThanOrEqual(80);
      expect(result.warnings.some((w) => w.includes('HTML tags present'))).toBe(true);
    });

    test('detects minor HTML tags (>10 tags)', () => {
      const minorHtml = 'text '.repeat(100) + '<em>x</em>'.repeat(15);
      const result = validateMarkdown(minorHtml);

      expect(result.score).toBeLessThanOrEqual(95);
      expect(result.warnings.some((w) => w.includes('minor HTML tags'))).toBe(true);
    });

    test('detects unconverted table tags', () => {
      const tableContent = 'text '.repeat(100) + '<tr><td>cell</td></tr>'.repeat(30);
      const result = validateMarkdown(tableContent);

      expect(result.issues.some((i) => i.includes('unconverted table tags'))).toBe(true);
    });

    test('detects high HTML ratio (>30%)', () => {
      // Create content that's mostly HTML tags
      const highRatio = '<div class="very-long-class-name">x</div>'.repeat(50);
      const result = validateMarkdown(highRatio);

      expect(result.issues.some((i) => i.includes('% of content is HTML tags'))).toBe(true);
    });

    test('detects script tags', () => {
      const withScript = `${'Normal content '.repeat(30)}<script>alert("x")</script>`;
      const result = validateMarkdown(withScript);

      expect(result.warnings.some((w) => w.includes('script tags present'))).toBe(true);
    });

    test('detects style tags', () => {
      const withStyle = `${'Normal content '.repeat(30)}<style>.x{color:red}</style>`;
      const result = validateMarkdown(withStyle);

      expect(result.warnings.some((w) => w.includes('style tags present'))).toBe(true);
    });

    test('returns score 0 for blank content', () => {
      const result = validateMarkdown('');

      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toContain('Blank content - no text extracted');
    });

    test('detects extremely short content (<50 chars)', () => {
      const short = 'Hello world';
      const result = validateMarkdown(short);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('Extremely short content'))).toBe(true);
    });

    test('warns about short content (<300 chars)', () => {
      const shortish = 'This is some content that is longer than 50 characters but still relatively short for a full article. ' +
        'It has enough text to pass the minimum threshold but not enough to be considered a complete article.';
      const result = validateMarkdown(shortish);

      expect(result.warnings.some((w) => w.includes('Short content'))).toBe(true);
    });

    test('detects excessive newlines', () => {
      // Need 5+ consecutive newlines in more than 10 places
      let content = 'text '.repeat(100);
      for (let i = 0; i < 15; i++) {
        content += '\n\n\n\n\n\n' + 'more text ';
      }
      const result = validateMarkdown(content);

      expect(result.warnings.some((w) => w.includes('excessive newlines'))).toBe(true);
    });

    test('isValid is false when score < 60', () => {
      // Lots of HTML + short content should push below 60
      const badContent = '<div>x</div>'.repeat(110);
      const result = validateMarkdown(badContent);

      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(60);
    });

    test('isValid is true when score >= 60', () => {
      const okContent = 'This is a reasonable article with enough content to pass validation. '.repeat(10);
      const result = validateMarkdown(okContent);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    test('score never goes below 0', () => {
      // Combine multiple penalties
      const terrible = '<script>x</script>'.repeat(10) + '<style>x</style>'.repeat(10) + '<div>x</div>'.repeat(200);
      const result = validateMarkdown(terrible);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatValidationReport', () => {
    test('shows Excellent for score >= 90', () => {
      const report = formatValidationReport({ isValid: true, score: 95, issues: [], warnings: [] });
      expect(report).toContain('Excellent');
    });

    test('shows Good for score >= 75', () => {
      const report = formatValidationReport({ isValid: true, score: 80, issues: [], warnings: [] });
      expect(report).toContain('Good');
    });

    test('shows Acceptable for score >= 60', () => {
      const report = formatValidationReport({ isValid: true, score: 65, issues: [], warnings: [] });
      expect(report).toContain('Acceptable');
    });

    test('shows Poor for score < 60', () => {
      const report = formatValidationReport({ isValid: false, score: 50, issues: [], warnings: [] });
      expect(report).toContain('Poor');
    });

    test('includes issues in report', () => {
      const report = formatValidationReport({
        isValid: false,
        score: 30,
        issues: ['Too many HTML tags', 'Content too short'],
        warnings: [],
      });
      expect(report).toContain('**Issues**');
      expect(report).toContain('Too many HTML tags');
      expect(report).toContain('Content too short');
    });

    test('includes warnings in report', () => {
      const report = formatValidationReport({
        isValid: true,
        score: 75,
        issues: [],
        warnings: ['Minor HTML present', 'Short content'],
      });
      expect(report).toContain('**Warnings**');
      expect(report).toContain('Minor HTML present');
      expect(report).toContain('Short content');
    });

    test('includes score in report', () => {
      const report = formatValidationReport({ isValid: true, score: 85, issues: [], warnings: [] });
      expect(report).toContain('85/100');
    });
  });
});
