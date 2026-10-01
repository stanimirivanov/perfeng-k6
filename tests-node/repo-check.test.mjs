import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkRepository, formatViolation } from '../scripts/repo-check.mjs';

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'perfeng-k6-repo-check-'));
  write(root, 'README.md', '# Example\n\n## TL;DR\n\n- Example.\n');
  write(root, 'CONTRIBUTING.md', '# Contributing\n\n## TL;DR\n\n- Policy.\n');
  write(
    root,
    'docs/decisions/README.md',
    '# Architecture decision records\n\n## TL;DR\n\n- Decisions.\n\n## Index\n',
  );
  write(
    root,
    '.github/ISSUE_TEMPLATE/work-item.md',
    '**Repository:** perfeng-k6\n**Milestone:** MNN — Outcome\n\n## Goal\n\n## Scope\n\n## Design decisions\n\n## Security and operations\n\n## Acceptance criteria\n\n## Verification\n\n## Out of scope\n',
  );
  write(
    root,
    '.github/PULL_REQUEST_TEMPLATE.md',
    '## Linked work\n\n## Outcome and scope\n\n## Design, compatibility and operations\n\n## Verification\n\nChecks not run, blocking reason and residual risk:\n\n## Limitations and review\n',
  );
  return root;
}

test('valid repository policy fixture passes', () => {
  assert.deepEqual(checkRepository(fixture()), []);
});

test('missing paths and anchors have actionable diagnostics', () => {
  const root = fixture();
  write(
    root,
    'docs/guide.md',
    '# Guide\n\n## TL;DR\n\n[missing](none.md) [anchor](../README.md#absent)\n',
  );
  const rendered = checkRepository(root).map(formatViolation).join('\n');
  assert.match(rendered, /does not resolve/);
  assert.match(rendered, /missing heading/);
  assert.match(rendered, /fix:/);
});

test('action policy accepts majors and local sources but checks composite actions', () => {
  const root = fixture();
  write(
    root,
    '.github/workflows/nested/validate.yml',
    [
      'jobs:',
      '  validate:',
      '    steps:',
      '      - uses: "actions/checkout@v7" # semantic major',
      "      - uses: './.github/actions/local'",
      '      - uses: docker://alpine:3.22',
      '      - uses: owner/unversioned',
      '      - run: >-',
      "          echo 'uses: owner/not-an-action@abcdef'",
      '',
    ].join('\n'),
  );
  write(
    root,
    '.github/actions/example/action.yaml',
    "runs:\n  using: composite\n  steps:\n    - uses: 'owner/action@abcdef'\n",
  );

  const violations = checkRepository(root);
  const rendered = violations.map(formatViolation).join('\n');
  assert.equal(violations.length, 2, rendered);
  assert.match(
    rendered,
    /\.github\/actions\/example\/action\.yaml:4: \[workflow\.action-version\]/,
  );
  assert.match(
    rendered,
    /\.github\/workflows\/nested\/validate\.yml:7: \[workflow\.action-version\]/,
  );
  assert.match(rendered, /owner\/action@abcdef/);
  assert.match(rendered, /owner\/unversioned/);
  assert.doesNotMatch(rendered, /not-an-action|actions\/checkout|docker:\/\/|actions\/local/);
});
