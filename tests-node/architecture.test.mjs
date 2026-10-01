import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkRuntimeArchitecture, inspectRuntimeSource } from '../scripts/architecture.mjs';

test('checked-in runtime sources stay independent from Node tooling', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  assert.deepEqual(checkRuntimeArchitecture(root), []);
});

test('runtime boundary rejects Node, npm, and tooling imports', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'perfeng-k6-architecture-'));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  mkdirSync(join(root, 'lib'));
  mkdirSync(join(root, 'tests'));
  mkdirSync(join(root, 'scripts'));
  const file = join(root, 'tests', 'scenario.js');
  const source = `
    import fs from 'node:fs';
    import Ajv from 'ajv';
    import { run } from '../scripts/run.mjs';
  `;
  writeFileSync(file, source);
  const violations = inspectRuntimeSource(root, file, source).join('\n');
  assert.match(violations, /node:fs/);
  assert.match(violations, /ajv/);
  assert.match(violations, /tooling or escapes/);
});

test('runtime boundary parses re-exports and ignores comments', () => {
  const root = '/repository';
  const file = '/repository/tests/scenario.js';
  const source = `
    // import ignored from 'comment-only-package';
    export { readFile } from 'node:fs';
    export * from 'ajv';
  `;

  const violations = inspectRuntimeSource(root, file, source).join('\n');
  assert.match(violations, /node:fs/);
  assert.match(violations, /ajv/);
  assert.doesNotMatch(violations, /comment-only-package/);
});
