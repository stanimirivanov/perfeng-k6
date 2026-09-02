import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const version = readFileSync(resolve(root, '.k6-version'), 'utf8').trim();

export function checkVersion() {
  const result = spawnSync('k6', ['version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0 || !result.stdout.includes(`v${version} `)) {
    throw new Error(`Install k6 ${version}; found: ${result.stdout || result.error || 'unavailable'}`);
  }
}

export function run(test, profile, output, env = process.env, config) {
  const registry = JSON.parse(readFileSync(resolve(root, 'workloads/registry.json'), 'utf8'));
  if (!Object.hasOwn(registry.testScenarios, test) ||
      !registry.testScenarios[test].supportedProfiles.includes(profile)) {
    throw new Error('Unsupported test/profile combination');
  }
  checkVersion();
  // Refuse to overwrite any previous run, including incomplete runs.
  const directory = resolve(output);
  mkdirSync(directory, { recursive: false });
  const args = ['run', '--no-usage-report', '--config',
    config || resolve(root, `workloads/${profile}/${test}.json`),
    '--summary-export', resolve(directory, 'summary.json'),
    '--out', `json=${resolve(directory, 'points.jsonl')}`,
    resolve(root, `tests/${test}/scenario.js`)];
  const result = spawnSync('k6', args, { env, stdio: 'inherit', cwd: root });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 5) throw new Error('Usage: node scripts/run.mjs TEST PROFILE NEW_OUTPUT_DIRECTORY');
    process.exitCode = run(...process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
