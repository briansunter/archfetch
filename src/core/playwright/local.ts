import type { Browser } from 'playwright';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import type { PlaywrightConfig } from '../../config/schema';
import type { BrowserManager } from './types';

chromium.use(stealth());

let browserInstance: Browser | null = null;

export class LocalBrowserManager implements BrowserManager {
  private config: PlaywrightConfig;

  constructor(config: PlaywrightConfig) {
    this.config = config;
  }

  async getBrowser(): Promise<Browser> {
    if (!browserInstance) {
      browserInstance = await chromium.launch({
        headless: true,
        timeout: this.config.timeout,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-infobars',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-networking',
          '--disable-dev-shm-usage',
        ],
      });
    }
    return browserInstance;
  }

  async closeBrowser(): Promise<void> {
    if (browserInstance) {
      await browserInstance.close();
      browserInstance = null;
    }
  }

  isDocker(): boolean {
    return false;
  }
}
