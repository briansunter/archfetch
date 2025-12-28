import type { FetchiConfig } from './schema';

export const DEFAULT_CONFIG: FetchiConfig = {
  quality: {
    minScore: 60,
    jsRetryThreshold: 85,
  },
  paths: {
    tempDir: '.tmp',
    docsDir: 'docs/ai/references',
  },
  playwright: {
    timeout: 30000,
    waitStrategy: 'networkidle',
  },
  retry: {
    maxAttempts: 2,
    backoffMs: 1000,
  },
};
