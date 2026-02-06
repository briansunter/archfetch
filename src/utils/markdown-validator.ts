/**
 * Markdown Quality Validator
 *
 * Validates that extracted markdown is clean, substantive, and usable.
 * Returns quality score and issues.
 */

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  warnings: string[];
}

export interface ValidationOptions {
  /** Length of the source HTML before extraction (enables ratio analysis) */
  sourceHtmlLength?: number;
}

/**
 * Common patterns that indicate error pages, login walls, bot detection,
 * or other non-article content. Matched case-insensitively against the
 * stripped text content of the markdown.
 */
const BOILERPLATE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bare you a robot\b/i, label: 'bot detection page' },
  { pattern: /\bcomplete the captcha\b/i, label: 'captcha page' },
  { pattern: /\bverify you are human\b/i, label: 'bot verification page' },
  { pattern: /\bplease verify/i, label: 'verification page' },
  { pattern: /\benable javascript\b/i, label: 'JS-required page' },
  { pattern: /\bjavascript is required\b/i, label: 'JS-required page' },
  { pattern: /\bbrowser.*not supported\b/i, label: 'unsupported browser page' },
  { pattern: /\bpage not found\b/i, label: '404 page' },
  { pattern: /\b404\b.*\bnot found\b/i, label: '404 page' },
  { pattern: /\bsomething went wrong\b/i, label: 'error page' },
  { pattern: /\ban error occurred\b/i, label: 'error page' },
  { pattern: /\bunexpected error\b/i, label: 'error page' },
  { pattern: /\baccess denied\b/i, label: 'access denied page' },
  { pattern: /\bforbidden\b.*\byou don.t have permission\b/i, label: 'forbidden page' },
  { pattern: /\blog in to continue\b/i, label: 'login wall' },
  { pattern: /\bsign in to continue\b/i, label: 'login wall' },
  { pattern: /\blog in to your account\b/i, label: 'login wall' },
  { pattern: /\bplease log in\b/i, label: 'login wall' },
  { pattern: /\bto continue,?\s*(please\s+)?log\s*in\b/i, label: 'login wall' },
  { pattern: /\bcreate a free account\b.*\bto\s+(continue|read|view|access)\b/i, label: 'signup wall' },
  { pattern: /\bsubscribe to (continue|read|access)\b/i, label: 'paywall' },
  { pattern: /\bthis content is available.*subscribers\b/i, label: 'paywall' },
];

function stripMarkdownSyntax(markdown: string): string {
  return markdown
    .replace(/<[^>]*>/g, '')
    .replace(/[#*\-_`[\]()]/g, '')
    .trim();
}

export function validateMarkdown(markdown: string, options?: ValidationOptions): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // --- HTML tag analysis ---
  const htmlTagMatches = markdown.match(/<[^>]+>/g);
  const htmlTagCount = htmlTagMatches ? htmlTagMatches.length : 0;

  if (htmlTagCount > 100) {
    score -= 40;
    issues.push(`${htmlTagCount} leftover HTML tags found (likely forum/discussion thread)`);
  } else if (htmlTagCount > 50) {
    score -= 20;
    warnings.push(`${htmlTagCount} HTML tags present`);
  } else if (htmlTagCount > 10) {
    score -= 5;
    warnings.push(`${htmlTagCount} minor HTML tags present`);
  }

  // --- Unconverted table tags ---
  const tableTagMatches = markdown.match(/<t[rd][\s>]/gi);
  const tableTagCount = tableTagMatches ? tableTagMatches.length : 0;

  if (tableTagCount > 50) {
    score -= 30;
    issues.push(`${tableTagCount} unconverted table tags (complex layout not suitable)`);
  }

  // --- HTML character ratio ---
  const htmlCharCount = markdown.match(/<[^>]*>/g)?.join('').length || 0;
  const htmlRatio = markdown.length > 0 ? htmlCharCount / markdown.length : 0;

  if (htmlRatio > 0.3) {
    score -= 25;
    issues.push(`${(htmlRatio * 100).toFixed(1)}% of content is HTML tags`);
  } else if (htmlRatio > 0.15) {
    score -= 10;
    warnings.push(`${(htmlRatio * 100).toFixed(1)}% HTML tag ratio`);
  }

  // --- Script / style tags ---
  const scriptMatches = markdown.match(/<script/gi);
  if (scriptMatches && scriptMatches.length > 0) {
    score -= 15;
    warnings.push(`${scriptMatches.length} script tags present`);
  }

  const styleMatches = markdown.match(/<style/gi);
  if (styleMatches && styleMatches.length > 0) {
    score -= 10;
    warnings.push(`${styleMatches.length} style tags present`);
  }

  // --- Content length analysis ---
  const contentText = stripMarkdownSyntax(markdown);
  const contentLength = contentText.length;

  if (contentLength === 0) {
    score = 0;
    issues.push('Blank content - no text extracted');
  } else if (contentLength < 50) {
    score -= 50;
    issues.push(`Extremely short content (${contentLength} chars) - likely extraction failure`);
  } else if (contentLength < 200 && (htmlTagCount > 50 || tableTagCount > 20)) {
    score -= 30;
    issues.push(`Only ${contentLength} chars of actual content with excessive HTML (extraction likely failed)`);
  } else if (contentLength < 300) {
    score -= 15;
    warnings.push(`Short content (${contentLength} chars) - may not be a full article`);
  }

  // --- Content-to-source ratio (new) ---
  if (options?.sourceHtmlLength && options.sourceHtmlLength > 0 && contentLength > 0) {
    const extractionRatio = contentLength / options.sourceHtmlLength;

    // If a 200K HTML page produced only 500 chars of text, that's deeply suspicious
    if (options.sourceHtmlLength > 10000 && extractionRatio < 0.005) {
      score -= 35;
      issues.push(
        `Extraction ratio extremely low (${contentLength} chars from ${Math.round(options.sourceHtmlLength / 1024)}KB HTML) - likely JS-rendered or gated content`
      );
    } else if (options.sourceHtmlLength > 10000 && extractionRatio < 0.02) {
      score -= 20;
      warnings.push(
        `Low extraction ratio (${contentLength} chars from ${Math.round(options.sourceHtmlLength / 1024)}KB HTML)`
      );
    }
  }

  // --- Boilerplate / error page detection (new) ---
  if (contentLength > 0 && contentLength < 2000) {
    // Only check short content — long real articles may mention these phrases in passing
    for (const { pattern, label } of BOILERPLATE_PATTERNS) {
      if (pattern.test(contentText)) {
        score -= 40;
        issues.push(`Detected ${label} — content is not a real article`);
        break; // One match is enough
      }
    }
  }

  // --- Excessive newlines ---
  const excessiveNewlines = markdown.match(/\n{5,}/g);
  if (excessiveNewlines && excessiveNewlines.length > 10) {
    score -= 5;
    warnings.push(`${excessiveNewlines.length} sections with excessive newlines`);
  }

  // --- Final result ---
  const finalScore = Math.max(0, score);

  return {
    isValid: finalScore >= 60,
    score: finalScore,
    issues,
    warnings,
  };
}

/**
 * Generate human-readable quality report
 */
export function formatValidationReport(result: ValidationResult): string {
  let report = `**Quality Score**: ${result.score}/100`;

  if (result.score >= 90) {
    report += ' Excellent';
  } else if (result.score >= 75) {
    report += ' Good';
  } else if (result.score >= 60) {
    report += ' Acceptable';
  } else {
    report += ' Poor';
  }

  if (result.issues.length > 0) {
    report += '\n\n**Issues**:\n';
    for (const issue of result.issues) {
      report += `- ${issue}\n`;
    }
  }

  if (result.warnings.length > 0) {
    report += '\n**Warnings**:\n';
    for (const warning of result.warnings) {
      report += `- ${warning}\n`;
    }
  }

  return report;
}
