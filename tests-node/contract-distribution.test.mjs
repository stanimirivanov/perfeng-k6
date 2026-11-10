import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { checkProjection } from '../scripts/contract-distribution.mjs';
import { lock, root } from '../scripts/contracts.mjs';

const selection = { sourceRevision: lock.commit, version: lock.version, members: lock.files };
const readVendored = (path) => readFileSync(join(root, 'vendor/contracts', path));

test('checks every selected vendored byte and permits verified closure-only members', () => {
  assert.equal(
    checkProjection(selection, { ...lock.files, 'extra.json': 'a'.repeat(64) }, readVendored),
    6,
  );
});

test('rejects an incomplete or substituted signed projection', () => {
  const { LICENSE: _license, ...incomplete } = lock.files;
  assert.throws(
    () => checkProjection(selection, incomplete, readVendored),
    /Signed member differs: LICENSE/,
  );
  assert.throws(
    () => checkProjection(selection, { ...lock.files, LICENSE: 'a'.repeat(64) }, readVendored),
    /Signed member differs: LICENSE/,
  );
});

test('rejects another source, version, or incomplete reviewed selection', () => {
  for (const change of [
    { sourceRevision: '8363ec6d54721a4750761df37c80465e9f76be4d' },
    { version: '0.4.0' },
    { members: { LICENSE: lock.files.LICENSE } },
  ]) {
    assert.throws(
      () => checkProjection({ ...selection, ...change }, lock.files, readVendored),
      /differs from the existing contract lock/,
    );
  }
});

test('rejects changed vendored bytes', () => {
  assert.throws(
    () =>
      checkProjection(selection, lock.files, (path) =>
        path === 'LICENSE' ? Buffer.from('changed') : readVendored(path),
      ),
    /Vendored member differs: LICENSE/,
  );
});
