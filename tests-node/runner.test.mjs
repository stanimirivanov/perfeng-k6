import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { checkVersion, root, run } from '../scripts/run.mjs';
import { fixture } from './fixture.mjs';

checkVersion();
// Never forward a developer's k6 output destinations, credentials, or overrides
// into the loopback-only fixture runs.
const fixtureEnvironment = Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => !key.toUpperCase().startsWith('K6_')));
fixtureEnvironment.AUTH_TOKEN = '';
fixtureEnvironment.API_VERSION = 'v1';
const temporary = mkdtempSync(join(tmpdir(), 'perfeng-k6-'));
const config = join(temporary, 'fixture.json');
writeFileSync(config, JSON.stringify({
  scenarios: { fixture: { executor: 'shared-iterations', vus: 1, iterations: 3, maxDuration: '10s' } },
  thresholds: { checks: ['rate==1'], biz_transaction_error_rate: ['rate==0'] }
}));

for (const [scenario, mode] of [
  ['checkout', 'ok'], ['search', 'ok'], ['account', 'ok'],
  ['checkout', 'cart-failure'], ['checkout', 'missing-order'],
  ['checkout', 'malformed-order'],
  ['search', 'search-failure'], ['account', 'preferences-failure']
]) {
  test(`${scenario}: ${mode}`, { timeout: 30000 }, async () => {
    const { server, url } = await fixture(mode);
    const output = join(temporary, `${scenario}-${mode}`);
    const moduleUrl = pathToFileURL(join(root, 'scripts/run.mjs')).href;
    const program = `import { run } from ${JSON.stringify(moduleUrl)};
      process.exitCode = run(${JSON.stringify(scenario)}, 'smoke',
        ${JSON.stringify(output)}, process.env, ${JSON.stringify(config)});`;
    const args = ['--input-type=module', '-e', program];
    try {
      const child = spawn(process.execPath, args, {
        cwd: root, env: { ...fixtureEnvironment, BASE_URL: url, THINK_TIME: '0' },
        timeout: 20000
      });
      let log = '';
      child.stdout.on('data', bytes => { log += bytes; });
      child.stderr.on('data', bytes => { log += bytes; });
      const code = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', resolve);
      });
      assert.equal(code, mode === 'ok' ? 0 : 99, log);
      const summary = JSON.parse(readFileSync(join(output, 'summary.json'), 'utf8'));
      assert.equal(summary.metrics.biz_transaction_error_rate.value, mode === 'ok' ? 0 : 1);
      const records = readFileSync(join(output, 'points.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert(records.some(record => record.type === 'Point' && record.metric === 'http_req_duration'));
      assert(records.some(record => record.type === 'Point' && record.metric === 'biz_transaction_error_rate'));
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
}

test('reject unknown scenarios/profiles and existing output directories before running', () => {
  assert.throws(() => run('../checkout', 'smoke', temporary), /Unsupported/);
  assert.throws(() => run('account', 'capacity', temporary), /Unsupported/);
  assert.throws(() => run('checkout', 'smoke', temporary), /EEXIST/);
});

test('initialization failures retain a nonzero exit without a fabricated summary', { timeout: 30000 }, async () => {
  const output = join(temporary, 'initialization-failure');
  const moduleUrl = pathToFileURL(join(root, 'scripts/run.mjs')).href;
  const program = `import { run } from ${JSON.stringify(moduleUrl)};
    process.exitCode = run('checkout', 'smoke', ${JSON.stringify(output)},
      process.env, ${JSON.stringify(config)});`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', program], {
    env: { ...fixtureEnvironment, THINK_TIME: '-1' }, stdio: 'ignore', timeout: 20000
  });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  assert.notEqual(code, 0);
  assert.notEqual(code, 99);
  assert.throws(() => readFileSync(join(output, 'summary.json')), /ENOENT/);
});
