import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkVersion, root } from './run.mjs';

checkVersion();
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== null)
      .map(([key, item]) => [key, canonical(item)]));
  }
  // k6 renders 1m as 1m0s and adds null defaults when resolving config.
  if (typeof value === 'string' && /^(?:\d+(?:\.\d+)?(?:ms|s|m|h))+$/.test(value)) {
    return [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)]
      .reduce((sum, [, amount, unit]) => sum + Number(amount) * { ms: 0.001, s: 1, m: 60, h: 3600 }[unit], 0);
  }
  return value;
}
const registry = JSON.parse(readFileSync(resolve(root, 'workloads/registry.json'), 'utf8'));
let count = 0;
for (const [test, entry] of Object.entries(registry.testScenarios)) {
  const script = resolve(root, `tests/${test}/scenario.js`);
  assert(!readFileSync(script, 'utf8').includes('export const options'));
  for (const profile of entry.supportedProfiles) {
    const config = resolve(root, `workloads/${profile}/${test}.json`);
    const expected = JSON.parse(readFileSync(config, 'utf8'));
    const result = spawnSync('k6', ['inspect', '--execution-requirements', '--config', config, script], { encoding: 'utf8', cwd: root });
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout);
    assert.deepEqual(canonical(actual.scenarios), canonical(expected.scenarios));
    assert.deepEqual(actual.thresholds, expected.thresholds);
    count++;
  }
}
console.log(`Validated ${count} scenario/profile combinations using k6 inspect.`);
