import { lookup } from 'node:dns/promises';
import type { FetchiConfig } from '../config/schema';
import { getErrorMessage } from '../utils/error';
import { type ValidationResult, validateMarkdown } from '../utils/markdown-validator';
import { processHtmlToMarkdown } from './extractor';
import { closeBrowser, fetchWithBrowser } from './playwright/manager';

export interface FetchResultSuccess {
  success: true;
  markdown: string;
  title: string;
  quality: ValidationResult;
  byline?: string;
  excerpt?: string;
  siteName?: string;
  usedPlaywright?: boolean;
  playwrightReason?: string;
  suggestion?: string;
}

export interface FetchResultError {
  success: false;
  error: string;
  quality?: ValidationResult;
  suggestion?: string;
  usedPlaywright?: boolean;
  playwrightReason?: string;
}

export type FetchResult = FetchResultSuccess | FetchResultError;

interface SimpleFetchResult {
  html: string;
  error?: string;
}

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost') {
    return true;
  }

  // Check for IPv6 loopback
  if (hostname === '::1' || hostname === '[::1]') {
    return true;
  }

  // Strip brackets from IPv6 addresses
  const cleanHost = hostname.replace(/^\[|\]$/g, '');

  // Check IPv6 private ranges
  const lowerHost = cleanHost.toLowerCase();
  // fc00::/7 covers fc00:: through fdff::
  if (/^f[cd][0-9a-f]{2}:/i.test(lowerHost)) {
    return true;
  }
  // fe80::/10 (link-local)
  if (/^fe[89ab][0-9a-f]:/i.test(lowerHost)) {
    return true;
  }

  // Check IPv4 ranges
  const ipv4Match = cleanHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (private)
    if (a === 10) return true;
    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local / AWS metadata)
    if (a === 169 && b === 254) return true;
  }

  return false;
}

async function simpleFetch(url: string, verbose = false): Promise<SimpleFetchResult> {
  try {
    if (verbose) {
      console.error(`📡 Simple fetch: ${url}`);
    }

    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      return { html: '', error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const html = await response.text();

    if (verbose) {
      console.error(`📡 Simple fetch: Got ${html.length} chars`);
    }

    return { html };
  } catch (error) {
    const message = getErrorMessage(error);
    return { html: '', error: message };
  }
}

async function tryPlaywright(url: string, config: FetchiConfig, reason: string, verbose = false): Promise<FetchResult> {
  if (verbose) {
    console.error(`🎭 Trying Playwright (reason: ${reason})`);
  }

  const browserResult = await fetchWithBrowser(url, config.playwright, verbose);

  if (browserResult.error) {
    return {
      success: false,
      error: `Playwright fetch failed: ${browserResult.error}`,
    };
  }

  const extracted = await processHtmlToMarkdown(browserResult.html, url, verbose);

  if (extracted.error) {
    return {
      success: false,
      error: extracted.error,
    };
  }

  const quality = validateMarkdown(extracted.markdown!, { sourceHtmlLength: browserResult.html.length });

  if (quality.score < config.quality.minScore) {
    return {
      success: false,
      error: `Content quality too low (${quality.score}/100) even with JavaScript rendering`,
      quality,
      suggestion: 'This page may be a login wall, forum, or complex web app not suitable for article extraction',
      usedPlaywright: true,
      playwrightReason: reason,
    };
  }

  return {
    success: true,
    markdown: extracted.markdown!,
    title: extracted.title ?? '',
    byline: extracted.byline,
    excerpt: extracted.excerpt,
    siteName: extracted.siteName,
    quality,
    usedPlaywright: true,
    playwrightReason: reason,
  };
}

export async function fetchUrl(
  url: string,
  config: FetchiConfig,
  verbose = false,
  forcePlaywright = false
): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        success: false,
        error: `Invalid URL protocol: ${parsed.protocol} — only http and https are supported`,
      };
    }
  } catch {
    return {
      success: false,
      error: `Invalid URL: ${url}`,
    };
  }

  // SSRF protection: check if hostname is a private/internal address
  const hostname = parsed.hostname;
  if (isPrivateHost(hostname)) {
    return {
      success: false,
      error: 'URL points to a private/internal network address',
    };
  }

  // DNS resolution check: resolve hostname and verify the IP is not private
  try {
    const { address } = await lookup(hostname);
    if (isPrivateHost(address)) {
      return {
        success: false,
        error: 'URL points to a private/internal network address',
      };
    }
  } catch {
    // DNS resolution failure will be handled by the actual fetch
  }

  if (forcePlaywright) {
    if (verbose) {
      console.error('⚡ Force Playwright mode enabled');
    }
    return tryPlaywright(url, config, 'forced', verbose);
  }

  const simpleResult = await simpleFetch(url, verbose);

  if (simpleResult.error) {
    if (verbose) {
      console.error(`📡 Simple fetch failed: ${simpleResult.error}`);
    }
    return tryPlaywright(url, config, 'network_error', verbose);
  }

  const extracted = await processHtmlToMarkdown(simpleResult.html, url, verbose);

  if (extracted.error) {
    if (verbose) {
      console.error(`📝 Extraction failed: ${extracted.error}`);
    }
    return tryPlaywright(url, config, 'extraction_failed', verbose);
  }

  const quality = validateMarkdown(extracted.markdown!, { sourceHtmlLength: simpleResult.html.length });

  if (verbose) {
    console.error(`📊 Quality score: ${quality.score}/100`);
    if (quality.issues.length > 0) {
      for (const issue of quality.issues) {
        console.error(`   ⚠ ${issue}`);
      }
    }
  }

  if (quality.score >= config.quality.jsRetryThreshold) {
    return {
      success: true,
      markdown: extracted.markdown!,
      title: extracted.title ?? '',
      byline: extracted.byline,
      excerpt: extracted.excerpt,
      siteName: extracted.siteName,
      quality,
    };
  }

  if (quality.score >= config.quality.minScore) {
    if (verbose) {
      console.error(`📊 Quality marginal (${quality.score}), trying Playwright...`);
    }

    const playwrightResult = await tryPlaywright(url, config, 'quality_marginal', verbose);

    if (playwrightResult.success && playwrightResult.quality.score > quality.score) {
      return playwrightResult;
    }

    return {
      success: true,
      markdown: extracted.markdown!,
      title: extracted.title ?? '',
      byline: extracted.byline,
      excerpt: extracted.excerpt,
      siteName: extracted.siteName,
      quality,
    };
  }

  if (verbose) {
    console.error(`📊 Quality too low (${quality.score}), trying Playwright...`);
  }

  return tryPlaywright(url, config, 'quality_too_low', verbose);
}

export { closeBrowser };
