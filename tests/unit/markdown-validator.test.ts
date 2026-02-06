import { describe, expect, test } from 'bun:test';
import { formatValidationReport, validateMarkdown } from '../../src/utils/markdown-validator';

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
      const shortish =
        'This is some content that is longer than 50 characters but still relatively short for a full article. ' +
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

  describe('content-to-source ratio', () => {
    test('penalizes extremely low extraction ratio (<0.5%)', () => {
      // 400 chars of content from a 200KB HTML page
      const content = 'This is some extracted content that is pretty short. '.repeat(8);
      const result = validateMarkdown(content, { sourceHtmlLength: 200_000 });

      expect(result.issues.some((i) => i.includes('Extraction ratio extremely low'))).toBe(true);
      expect(result.score).toBeLessThan(80);
    });

    test('warns on low extraction ratio (<2%)', () => {
      // 1500 chars of content from a 100KB HTML page = 1.5%
      const content = 'This is a moderately sized piece of extracted text content. '.repeat(25);
      const result = validateMarkdown(content, { sourceHtmlLength: 100_000 });

      expect(result.warnings.some((w) => w.includes('Low extraction ratio'))).toBe(true);
    });

    test('does not penalize good extraction ratio', () => {
      const content = 'This is substantial article content. '.repeat(200);
      const result = validateMarkdown(content, { sourceHtmlLength: 50_000 });

      expect(result.issues.filter((i) => i.includes('xtraction ratio'))).toEqual([]);
      expect(result.warnings.filter((w) => w.includes('xtraction ratio'))).toEqual([]);
      expect(result.score).toBe(100);
    });

    test('does not penalize when no source length provided', () => {
      const content = 'Short content here. ';
      const result = validateMarkdown(content);
      // Should only get short content warning, not ratio warning
      expect(result.issues.filter((i) => i.includes('xtraction ratio'))).toEqual([]);
    });

    test('does not penalize small HTML pages', () => {
      // 300 chars from a 5KB page — small page, totally fine
      const content = 'This is content from a small page that is perfectly fine. '.repeat(6);
      const result = validateMarkdown(content, { sourceHtmlLength: 5000 });

      expect(result.issues.filter((i) => i.includes('xtraction ratio'))).toEqual([]);
    });
  });

  describe('boilerplate / error page detection', () => {
    test('detects "something went wrong" error pages', () => {
      const content = "# Error\n\nSomething went wrong, but don't fret — let's give it another shot.";
      const result = validateMarkdown(content);

      expect(result.issues.some((i) => i.includes('error page'))).toBe(true);
      expect(result.score).toBeLessThan(60);
    });

    test('detects "page not found" 404 pages', () => {
      const content = '# Not Found\n\nPage not found. The page you are looking for does not exist.';
      const result = validateMarkdown(content);

      expect(result.issues.some((i) => i.includes('404 page'))).toBe(true);
      expect(result.score).toBeLessThan(60);
    });

    test('detects login wall content', () => {
      const content = '# Welcome\n\nPlease log in to continue viewing this content.';
      const result = validateMarkdown(content);

      expect(result.issues.some((i) => i.includes('login wall'))).toBe(true);
      expect(result.score).toBeLessThan(60);
    });

    test('detects "log in to continue" login wall', () => {
      const content = '# Reddit\n\nTo continue, log in to your account.';
      const result = validateMarkdown(content);

      expect(result.issues.some((i) => i.includes('login wall'))).toBe(true);
    });

    test('detects bot/captcha detection pages', () => {
      const content = '# Verify\n\nAre you a robot? Please complete the security check.';
      const result = validateMarkdown(content);

      expect(result.issues.some((i) => i.includes('bot detection page'))).toBe(true);
      expect(result.score).toBeLessThan(60);
    });

    test('detects paywall content', () => {
      const content = '# Article\n\nSubscribe to continue reading this exclusive content.';
      const result = validateMarkdown(content);

      expect(result.issues.some((i) => i.includes('paywall'))).toBe(true);
    });

    test('detects "access denied" pages', () => {
      const content = '# Forbidden\n\nAccess denied. You do not have permission to view this page.';
      const result = validateMarkdown(content);

      expect(result.issues.some((i) => i.includes('access denied'))).toBe(true);
    });

    test('detects JS-required pages', () => {
      const content = '# Notice\n\nPlease enable JavaScript to use this application.';
      const result = validateMarkdown(content);

      expect(result.issues.some((i) => i.includes('JS-required page'))).toBe(true);
    });

    test('does NOT flag boilerplate in long real articles', () => {
      // A real 5000-char article that happens to mention "page not found" in passing
      const content =
        'This is a lengthy technical article about web development. '.repeat(50) +
        'When a user encounters a page not found error, the server returns a 404 status code. ' +
        'More article content follows here with detailed explanations. '.repeat(30);
      const result = validateMarkdown(content);

      // Should NOT be flagged — the article is long enough to be real
      expect(result.issues.filter((i) => i.includes('404 page'))).toEqual([]);
      expect(result.score).toBe(100);
    });

    test('only applies one boilerplate penalty even if multiple patterns match', () => {
      const content = '# Error\n\nSomething went wrong. An error occurred. Please log in to continue.';
      const result = validateMarkdown(content);

      // Only one -40 penalty for boilerplate, not stacked
      const boilerplateIssues = result.issues.filter((i) => i.includes('not a real article'));
      expect(boilerplateIssues.length).toBe(1);
    });
  });

  describe('combined penalties', () => {
    test('low ratio + boilerplate stacks correctly', () => {
      // Short error content from a huge page
      const content = "# Error\n\nSomething went wrong, but don't fret.";
      const result = validateMarkdown(content, { sourceHtmlLength: 200_000 });

      // Should get: short content warning (-15) + ratio penalty (-35) + boilerplate (-40) = 10
      expect(result.score).toBeLessThan(30);
      expect(result.isValid).toBe(false);
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
