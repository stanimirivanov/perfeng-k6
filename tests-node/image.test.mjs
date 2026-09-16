import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  inventory,
  parseHashes,
  publishedReference,
  validateImageName,
} from '../scripts/image.mjs';

test('base image is digest-pinned and execution is explicitly non-root', () => {
  const file = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(file, /^FROM grafana\/k6:2\.2\.0@sha256:[0-9a-f]{64}$/m);
  assert.match(file, /^USER 12345:12345$/m);
});

test('inventory covers all runtime sources and workload definitions', () => {
  const files = inventory();
  for (const path of [
    '.k6-version',
    'lib/config.js',
    'tests/checkout/scenario.js',
    'workloads/smoke/checkout.json',
    'definitions/smoke/checkout.json',
  ]) {
    assert.match(files[path], /^[0-9a-f]{64}$/);
  }
  assert.equal(Object.keys(files).filter((path) => path.startsWith('definitions/')).length, 12);
});

test('image inventory parser rejects malformed or duplicate records', () => {
  const hash = 'a'.repeat(64);
  assert.deepEqual(parseHashes(hash + '  lib/config.js\n'), { 'lib/config.js': hash });
  for (const input of ['', 'bad', hash + '  a\n' + hash + '  a', hash + '  space name']) {
    assert.throws(() => parseHashes(input));
  }
});

test('image argument cannot become Docker options', () => {
  for (const image of ['--privileged', 'x;whoami', 'https://example.com/image', '']) {
    assert.throws(() => validateImageName(image));
  }
  validateImageName('ghcr.io/stanimirivanov/perfeng-k6@sha256:' + 'a'.repeat(64));
});

test('registry manifest digest is required, not an image ID or tag', () => {
  const repository = 'ghcr.io/stanimirivanov/perfeng-k6';
  const reference = repository + '@sha256:' + 'a'.repeat(64);
  assert.equal(publishedReference([reference], repository), reference);
  for (const values of [
    null,
    [],
    ['sha256:' + 'a'.repeat(64)],
    [repository + ':latest'],
    [repository + '@sha256:bad'],
    [reference, reference],
  ]) {
    assert.throws(() => publishedReference(values, repository));
  }
  assert.throws(() => publishedReference([reference], 'other.example/perfeng-k6'));
});
