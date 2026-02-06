import { z } from 'zod';

export const QualityConfigSchema = z.object({
  minScore: z.number().min(0).max(100).default(60),
  jsRetryThreshold: z.number().min(0).max(100).default(85),
});

export const PathsConfigSchema = z.object({
  tempDir: z.string().default('.tmp/arcfetch'),
  docsDir: z.string().default('docs/ai/references'),
});

export const PlaywrightConfigSchema = z.object({
  timeout: z.number().default(30000),
  waitStrategy: z.enum(['networkidle', 'domcontentloaded', 'load']).default('networkidle'),
});

export const FetchiConfigSchema = z.object({
  quality: QualityConfigSchema.default({}),
  paths: PathsConfigSchema.default({}),
  playwright: PlaywrightConfigSchema.default({}),
});

export type FetchiConfig = z.infer<typeof FetchiConfigSchema>;
export type QualityConfig = z.infer<typeof QualityConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type PlaywrightConfig = z.infer<typeof PlaywrightConfigSchema>;
