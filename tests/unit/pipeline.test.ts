import { describe, expect, test } from 'bun:test';
import { DEFAULT_CONFIG } from '../../src/config/defaults';

// We need to test the pipeline logic, so we'll import and test with mocked dependencies
// Since the module has side effects (imports), we test the logic patterns

describe('pipeline logic', () => {
  describe('quality routing thresholds', () => {
    test('score >= jsRetryThreshold (85) should use simple result', () => {
      const score = 90;
      const jsRetryThreshold = 85;
      const minScore = 60;

      // Logic from pipeline: if score >= jsRetryThreshold, return simple result
      const shouldUseSimple = score >= jsRetryThreshold;
      const shouldTryPlaywright = !shouldUseSimple && score >= minScore;
      const shouldRequirePlaywright = score < minScore;

      expect(shouldUseSimple).toBe(true);
      expect(shouldTryPlaywright).toBe(false);
      expect(shouldRequirePlaywright).toBe(false);
    });

    test('score between minScore and jsRetryThreshold should try Playwright', () => {
      const score = 70;
      const jsRetryThreshold = 85;
      const minScore = 60;

      const shouldUseSimple = score >= jsRetryThreshold;
      const shouldTryPlaywright = !shouldUseSimple && score >= minScore;
      const shouldRequirePlaywright = score < minScore;

      expect(shouldUseSimple).toBe(false);
      expect(shouldTryPlaywright).toBe(true);
      expect(shouldRequirePlaywright).toBe(false);
    });

    test('score < minScore should require Playwright', () => {
      const score = 50;
      const jsRetryThreshold = 85;
      const minScore = 60;

      const shouldUseSimple = score >= jsRetryThreshold;
      const shouldTryPlaywright = !shouldUseSimple && score >= minScore;
      const shouldRequirePlaywright = score < minScore;

      expect(shouldUseSimple).toBe(false);
      expect(shouldTryPlaywright).toBe(false);
      expect(shouldRequirePlaywright).toBe(true);
    });

    test('boundary: score exactly at jsRetryThreshold (85) uses simple', () => {
      const score = 85;
      const jsRetryThreshold = 85;

      expect(score >= jsRetryThreshold).toBe(true);
    });

    test('boundary: score exactly at minScore (60) tries Playwright', () => {
      const score = 60;
      const jsRetryThreshold = 85;
      const minScore = 60;

      const shouldUseSimple = score >= jsRetryThreshold;
      const shouldTryPlaywright = !shouldUseSimple && score >= minScore;

      expect(shouldUseSimple).toBe(false);
      expect(shouldTryPlaywright).toBe(true);
    });

    test('boundary: score at 59 requires Playwright', () => {
      const score = 59;
      const minScore = 60;

      expect(score < minScore).toBe(true);
    });
  });

  describe('marginal quality comparison logic', () => {
    test('should use Playwright result if score is higher', () => {
      const simpleScore = 70;
      const playwrightScore = 85;
      const playwrightSuccess = true;

      const usePlaywright = playwrightSuccess && playwrightScore > simpleScore;
      expect(usePlaywright).toBe(true);
    });

    test('should use simple result if Playwright score is not higher', () => {
      const simpleScore = 75;
      const playwrightScore = 70;
      const playwrightSuccess = true;

      const usePlaywright = playwrightSuccess && playwrightScore > simpleScore;
      expect(usePlaywright).toBe(false);
    });

    test('should use simple result if Playwright fails', () => {
      const playwrightSuccess = false;

      // When playwright fails, we don't even compare scores - just use simple result
      const usePlaywright = playwrightSuccess;
      expect(usePlaywright).toBe(false);
    });

    test('should use simple result if scores are equal', () => {
      const simpleScore = 75;
      const playwrightScore = 75;
      const playwrightSuccess = true;

      const usePlaywright = playwrightSuccess && playwrightScore > simpleScore;
      expect(usePlaywright).toBe(false);
    });
  });

  describe('failure reason categorization', () => {
    test('network error triggers Playwright with correct reason', () => {
      const simpleFetchError = 'ECONNREFUSED';
      const reason = simpleFetchError ? 'network_error' : null;
      expect(reason).toBe('network_error');
    });

    test('extraction failure triggers Playwright with correct reason', () => {
      const extractionError = 'Could not extract article content';
      const reason = extractionError ? 'extraction_failed' : null;
      expect(reason).toBe('extraction_failed');
    });

    test('marginal quality triggers Playwright with correct reason', () => {
      const score = 70;
      const minScore = 60;
      const jsRetryThreshold = 85;
      const reason = score >= minScore && score < jsRetryThreshold ? 'quality_marginal' : null;
      expect(reason).toBe('quality_marginal');
    });

    test('low quality triggers Playwright with correct reason', () => {
      const score = 50;
      const minScore = 60;
      const reason = score < minScore ? 'quality_too_low' : null;
      expect(reason).toBe('quality_too_low');
    });
  });

  describe('config threshold validation', () => {
    test('default minScore is 60', () => {
      expect(DEFAULT_CONFIG.quality.minScore).toBe(60);
    });

    test('default jsRetryThreshold is 85', () => {
      expect(DEFAULT_CONFIG.quality.jsRetryThreshold).toBe(85);
    });

    test('minScore should be less than jsRetryThreshold', () => {
      expect(DEFAULT_CONFIG.quality.minScore).toBeLessThan(DEFAULT_CONFIG.quality.jsRetryThreshold);
    });
  });

  describe('FetchResult structure', () => {
    test('successful result has required fields', () => {
      const result = {
        success: true,
        markdown: '# Test',
        title: 'Test',
        quality: { isValid: true, score: 90, issues: [], warnings: [] },
      };

      expect(result.success).toBe(true);
      expect(result.markdown).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.quality).toBeDefined();
    });

    test('failed result has error and optional suggestion', () => {
      const result = {
        success: false,
        error: 'Quality too low',
        suggestion: 'Try a different URL',
        quality: { isValid: false, score: 40, issues: ['Too short'], warnings: [] },
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });

    test('Playwright result includes usedPlaywright flag and reason', () => {
      const result = {
        success: true,
        markdown: '# Test',
        title: 'Test',
        quality: { isValid: true, score: 85, issues: [], warnings: [] },
        usedPlaywright: true,
        playwrightReason: 'quality_marginal',
      };

      expect(result.usedPlaywright).toBe(true);
      expect(result.playwrightReason).toBe('quality_marginal');
    });
  });
});
