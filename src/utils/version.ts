import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function getVersion(): string {
  try {
    const packageJsonPath = join(dirname(import.meta.path), '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}
