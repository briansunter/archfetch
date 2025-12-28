import { describe, expect, test } from 'bun:test';
import { processHtmlToMarkdown } from '../../src/core/extractor';

describe('HTML to Markdown extraction', () => {
  test('extracts article content from well-structured HTML', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Article Title</title></head>
      <body>
        <article>
          <h1>Test Article Title</h1>
          <p class="byline">By John Doe</p>
          <p>This is the first paragraph of the article. It contains enough content
          to pass the extraction threshold and be recognized as meaningful content
          by the Readability algorithm.</p>
          <p>Here is another paragraph with more content. The article continues
          with additional information that helps establish this as a real article
          rather than just a snippet or navigation element.</p>
          <h2>Section Header</h2>
          <p>This section contains even more content. We need enough text here
          to ensure the extraction algorithm recognizes this as article content
          worth preserving in the final markdown output.</p>
        </article>
      </body>
      </html>
    `;

    const result = await processHtmlToMarkdown(html, 'https://example.com/article');

    expect(result.error).toBeUndefined();
    expect(result.markdown).toBeDefined();
    expect(result.title).toBe('Test Article Title');
    expect(result.markdown).toContain('# Test Article Title');
    expect(result.markdown).toContain('first paragraph');
    expect(result.markdown).toContain('## Section Header');
  });

  test('returns error for empty HTML', async () => {
    const result = await processHtmlToMarkdown('', 'https://example.com');

    expect(result.error).toBeDefined();
  });

  test('returns error for minimal HTML with no meaningful content', async () => {
    // Truly minimal HTML that Readability cannot extract
    const html = `<!DOCTYPE html><html><head></head><body></body></html>`;

    const result = await processHtmlToMarkdown(html, 'https://example.com/empty');

    expect(result.error).toBeDefined();
    expect(result.error).toContain('Could not extract article content');
  });

  test('extracts metadata from article', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Metadata Test</title>
        <meta property="og:site_name" content="Test Site">
        <meta name="description" content="Article description excerpt">
      </head>
      <body>
        <article>
          <h1>Metadata Test Article</h1>
          <p class="author">By Jane Smith</p>
          <p>This is a substantial paragraph of content that should be extracted
          by the Readability algorithm. It needs to be long enough to be considered
          meaningful article content rather than just boilerplate text.</p>
          <p>Adding more paragraphs to ensure we have enough content for proper
          extraction. The algorithm needs a certain amount of text to work with
          in order to identify this as article content worth preserving.</p>
          <p>A third paragraph for good measure. This should definitely be enough
          content for the extraction algorithm to recognize this as a valid article
          and not just navigation or sidebar content.</p>
        </article>
      </body>
      </html>
    `;

    const result = await processHtmlToMarkdown(html, 'https://example.com/meta');

    expect(result.error).toBeUndefined();
    expect(result.title).toBeDefined();
  });

  test('converts HTML lists to markdown', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>List Test</title></head>
      <body>
        <article>
          <h1>Article with Lists</h1>
          <p>This article contains various list types that should be converted to markdown format properly.</p>
          <ul>
            <li>First item</li>
            <li>Second item</li>
            <li>Third item</li>
          </ul>
          <p>And here is an ordered list:</p>
          <ol>
            <li>Step one</li>
            <li>Step two</li>
            <li>Step three</li>
          </ol>
          <p>Additional content to ensure the article is long enough for extraction.</p>
        </article>
      </body>
      </html>
    `;

    const result = await processHtmlToMarkdown(html, 'https://example.com/lists');

    expect(result.error).toBeUndefined();
    expect(result.markdown).toBeDefined();
    expect(result.markdown).toContain('First item');
    expect(result.markdown).toContain('Second item');
    expect(result.markdown).toContain('Step one');
  });

  test('converts code blocks to markdown', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Code Test</title></head>
      <body>
        <article>
          <h1>Article with Code</h1>
          <p>This article demonstrates code extraction and conversion to markdown.</p>
          <pre><code>function hello() {
  console.log("Hello, world!");
}</code></pre>
          <p>The code above should be properly formatted in the markdown output.</p>
          <p>Additional content to ensure proper extraction of the full article.</p>
        </article>
      </body>
      </html>
    `;

    const result = await processHtmlToMarkdown(html, 'https://example.com/code');

    expect(result.error).toBeUndefined();
    expect(result.markdown).toBeDefined();
    expect(result.markdown).toContain('function hello()');
    expect(result.markdown).toContain('console.log');
  });

  test('handles special characters in content', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Special Characters</title></head>
      <body>
        <article>
          <h1>Article with Special Characters</h1>
          <p>This article contains special characters: &amp; &lt; &gt; &quot; &apos;</p>
          <p>Also unicode: café, naïve, résumé, 日本語</p>
          <p>More content to ensure proper article extraction with enough length.</p>
          <p>Adding additional paragraphs for the extraction algorithm.</p>
        </article>
      </body>
      </html>
    `;

    const result = await processHtmlToMarkdown(html, 'https://example.com/special');

    expect(result.error).toBeUndefined();
    expect(result.markdown).toBeDefined();
    expect(result.markdown).toContain('&');
    expect(result.markdown).toContain('café');
    expect(result.markdown).toContain('日本語');
  });

  test('includes URL in output header', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>URL Test</title></head>
      <body>
        <article>
          <h1>URL Inclusion Test</h1>
          <p>Testing that the source URL is included in the markdown header output.</p>
          <p>Adding more content for proper extraction by the algorithm.</p>
          <p>A third paragraph to ensure we have enough content.</p>
        </article>
      </body>
      </html>
    `;

    const testUrl = 'https://example.com/test-article-url';
    const result = await processHtmlToMarkdown(html, testUrl);

    expect(result.error).toBeUndefined();
    expect(result.markdown).toContain(testUrl);
  });
});
