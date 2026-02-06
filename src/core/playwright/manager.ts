import type { PlaywrightConfig } from '../../config/schema';
import { LocalBrowserManager } from './local';
import type { BrowserManager, FetchWithBrowserResult } from './types';

let currentManager: BrowserManager | null = null;

export async function getBrowserManager(config: PlaywrightConfig): Promise<BrowserManager> {
  if (currentManager) {
    return currentManager;
  }

  // Only local mode is supported
  currentManager = new LocalBrowserManager(config);
  return currentManager;
}

/** Common desktop viewport sizes to rotate through for fingerprint diversity */
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];

const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

const LOCALES = ['en-US', 'en-US', 'en-US', 'en-GB'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function fetchWithBrowser(
  url: string,
  config: PlaywrightConfig,
  verbose = false
): Promise<FetchWithBrowserResult> {
  const manager = await getBrowserManager(config);
  const browser = await manager.getBrowser();

  const viewport = pick(VIEWPORTS);
  const locale = pick(LOCALES);
  const timezone = pick(TIMEZONES);

  const context = await browser.newContext({
    viewport,
    locale,
    timezoneId: timezone,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    // Realistic browser headers
    extraHTTPHeaders: {
      'Accept-Language': `${locale},en;q=0.9`,
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-CH-UA': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    // Pretend we have granted permissions a real user would have
    permissions: ['geolocation'],
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    javaScriptEnabled: true,
  });

  const page = await context.newPage();

  try {
    // Override navigator properties that leak headless signals
    await page.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ],
      });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
      if (typeof Notification !== 'undefined') {
        Object.defineProperty(Notification, 'permission', { get: () => 'default' });
      }
      window.chrome = window.chrome || {};
      window.chrome.runtime = window.chrome.runtime || {};
    `);

    if (verbose) {
      console.error(
        `🎭 Playwright: Navigating to ${url} (${viewport.width}x${viewport.height}, ${locale}, ${timezone})`
      );
    }

    // Small random delay to avoid machine-like timing patterns
    await page.waitForTimeout(200 + Math.floor(Math.random() * 300));

    await page.goto(url, {
      waitUntil: config.waitStrategy,
      timeout: config.timeout,
    });

    // Wait a bit after load for lazy-loaded content / hydration
    await page.waitForTimeout(500 + Math.floor(Math.random() * 500));

    const html = await page.content();

    if (verbose) {
      console.error(`🎭 Playwright: Got ${html.length} chars of HTML`);
    }

    return { html };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { html: '', error: message };
  } finally {
    await page.close();
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (currentManager) {
    await currentManager.closeBrowser();
    currentManager = null;
  }
}
