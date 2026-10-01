import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLockfile } from '../scripts/licenses.mjs';

test('license inventory accepts reviewed permissive licenses', () => {
  assert.deepEqual(
    checkLockfile({
      lockfileVersion: 3,
      packages: { '': {}, 'node_modules/example': { license: 'MIT' } },
    }),
    [],
  );
});

test('license inventory rejects unknown or missing licenses', () => {
  const rejected = checkLockfile({
    lockfileVersion: 3,
    packages: {
      '': {},
      'node_modules/copyleft': { license: 'GPL-3.0-only' },
      'node_modules/unknown': {},
    },
  });
  assert.deepEqual(rejected, [
    'node_modules/copyleft: GPL-3.0-only',
    'node_modules/unknown: missing',
  ]);
});
