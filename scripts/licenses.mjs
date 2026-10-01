import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const allowed = new Set(['Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT']);

export function checkLockfile(lock) {
  if (!lock || lock.lockfileVersion !== 3 || !lock.packages || typeof lock.packages !== 'object') {
    throw new Error('package-lock.json is not a supported npm lockfile v3 inventory');
  }
  const rejected = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '') continue;
    if (typeof entry.license !== 'string' || !allowed.has(entry.license)) {
      rejected.push(`${path}: ${entry.license || 'missing'}`);
    }
  }
  return rejected.sort();
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
    const rejected = checkLockfile(lock);
    if (rejected.length)
      throw new Error(`dependencies use unapproved licenses: ${rejected.join(', ')}`);
    process.stdout.write(`Dependency licenses satisfy policy: ${[...allowed].sort().join(', ')}\n`);
  } catch (error) {
    process.stderr.write(`license-check: ${error.message}\n`);
    process.exitCode = 1;
  }
}
