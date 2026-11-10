import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkPackage, prepareSnapshot } from '../scripts/contract-distribution.mjs';
import { root } from '../scripts/contracts.mjs';

test('prepares an exact snapshot and refuses extra files and existing destinations', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'perfeng-k6-update-test-'));
  try {
    const projection = join(scratch, 'projection');
    const target = join(scratch, 'target');
    cpSync(join(root, 'vendor/contracts'), projection, { recursive: true });
    assert.equal(prepareSnapshot(projection, target), 6);
    assert.throws(() => prepareSnapshot(projection, target), /EEXIST/);
    writeFileSync(join(projection, 'unreviewed.json'), '{}');
    assert.throws(() => prepareSnapshot(projection, join(scratch, 'invalid')), /inventory/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('checks runner inventory against the retained rollback checkout', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'perfeng-k6-package-test-'));
  try {
    for (const path of [
      'lib',
      'tests',
      'workloads',
      'definitions',
      'vendor/contracts',
      '.k6-version',
      'contracts.lock.json',
    ]) {
      cpSync(join(root, path), join(scratch, path), { recursive: true });
    }
    assert.equal(checkPackage(scratch).matchedFiles, 6);
    writeFileSync(join(scratch, '.k6-version'), 'modified');
    assert.throws(() => checkPackage(scratch), /Runner inventory/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
