import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containedFile, digest, lock, parseJson, root } from './contracts.mjs';
import { inventory } from './image.mjs';

export function checkProjection(selection, verified, readVendored) {
  if (
    selection.sourceRevision !== lock.commit ||
    selection.version !== lock.version ||
    Object.keys(selection.members).length !== Object.keys(lock.files).length ||
    Object.entries(lock.files).some(([path, sha]) => selection.members[path] !== sha)
  ) {
    throw new Error('Shadow selection differs from the existing contract lock');
  }
  for (const [path, sha] of Object.entries(lock.files)) {
    if (verified[path] !== sha) throw new Error(`Signed member differs: ${path}`);
    if (digest(readVendored(path)) !== sha) throw new Error(`Vendored member differs: ${path}`);
  }
  return Object.keys(lock.files).length;
}

function readSnapshot(directory) {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter(
    (entry) => !entry.isDirectory(),
  );
  if (files.some((entry) => !entry.isFile()) || files.length !== Object.keys(lock.files).length) {
    throw new Error('Snapshot inventory differs from the reviewed contract lock');
  }
  return Object.fromEntries(
    Object.entries(lock.files).map(([path, expected]) => {
      const content = readFileSync(containedFile(directory, path));
      if (digest(content) !== expected) throw new Error(`Snapshot member differs: ${path}`);
      return [path, content];
    }),
  );
}

export function prepareSnapshot(projection, target) {
  const files = readSnapshot(projection);
  mkdirSync(target, { mode: 0o700 });
  try {
    for (const [path, content] of Object.entries(files)) {
      const output = join(target, path);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, content, { flag: 'wx' });
    }
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw error;
  }
  return Object.keys(files).length;
}

export function checkPackage(rollback) {
  const currentLock = readFileSync(join(root, 'contracts.lock.json'));
  assert.deepEqual(
    readFileSync(join(rollback, 'contracts.lock.json')),
    currentLock,
    'Rollback contract lock differs',
  );
  const current = readSnapshot(join(root, 'vendor/contracts'));
  assert.deepEqual(readSnapshot(join(rollback, 'vendor/contracts')), current);
  assert.deepEqual(inventory(rollback), inventory(), 'Runner inventory differs from rollback');
  return {
    status: 'passed',
    matchedFiles: Object.keys(current).length,
    sourceRevision: lock.commit,
  };
}

function python(executable, args, cwd) {
  return execFileSync(executable, args, {
    cwd,
    env: {},
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
}

function shadow(assets, bootstrap, verifier, target) {
  const policy = parseJson(readFileSync(join(root, 'contracts-distribution.lock.json')));
  const scratch = mkdtempSync(join(tmpdir(), 'perfeng-k6-contract-shadow-'));
  try {
    const tool = join(scratch, 'tool');
    const pins = join(scratch, 'pins.json');
    const publisher = join(scratch, 'publisher.json');
    writeFileSync(pins, JSON.stringify(policy.tool));
    writeFileSync(publisher, JSON.stringify(policy.publisher));
    python(
      join(bootstrap, '.venv/bin/python'),
      [
        '-EB',
        '-m',
        'scripts.contracts_tool_release',
        'restore',
        '--archive',
        join(assets, 'tool/materializer.tar.gz'),
        '--bundle',
        join(assets, 'tool/materializer.sigstore.jsonl'),
        '--verifier',
        verifier,
        '--pins',
        pins,
        '--target',
        tool,
      ],
      bootstrap,
    );

    const profile = join(assets, 'history', policy.selection.sourceRevision);
    const verified = parseJson(
      python(
        join(tool, 'runtime/bin/python3.12'),
        [
          '-EB',
          '-m',
          'scripts.contracts_inspect',
          '--manifest',
          `${profile}.manifest.json`,
          '--archive',
          `${profile}.tar.gz`,
          '--bundle',
          join(assets, 'history/manifest.sigstore.jsonl'),
          '--policy',
          publisher,
          '--verifier',
          verifier,
        ],
        tool,
      ),
    );
    const matchedFiles = checkProjection(policy.selection, verified, (path) =>
      readFileSync(containedFile(join(root, 'vendor/contracts'), path)),
    );
    if (target) {
      const store = join(scratch, 'store');
      const selection = join(scratch, 'selection.json');
      mkdirSync(store, { mode: 0o700 });
      writeFileSync(
        selection,
        JSON.stringify({
          sourceRevision: policy.selection.sourceRevision,
          members: Object.fromEntries(
            Object.entries(verified).map(([path, sha256]) => [
              path,
              {
                destination: `${Object.hasOwn(policy.selection.members, path) ? 'snapshot' : 'closure'}/${path}`,
                sha256,
              },
            ]),
          ),
        }),
      );
      const output = python(
        join(tool, 'runtime/bin/python3.12'),
        [
          '-IB',
          join(tool, 'materialize.py'),
          '--manifest',
          `${profile}.manifest.json`,
          '--archive',
          `${profile}.tar.gz`,
          '--bundle',
          join(assets, 'history/manifest.sigstore.jsonl'),
          '--policy',
          publisher,
          '--verifier',
          verifier,
          '--selection',
          selection,
          '--target',
          store,
          '--execute',
        ],
        scratch,
      );
      const pointer = readFileSync(join(store, 'current'), 'utf8');
      if (!/^[a-f0-9]{64}\n$/.test(pointer) || output !== join(store, pointer.trim()) + '\n') {
        throw new Error('Invalid materializer projection');
      }
      prepareSnapshot(join(store, pointer.trim(), 'snapshot'), target);
    }
    return {
      status: target ? 'prepared' : 'passed',
      toolRelease: policy.toolRelease,
      toolArchiveSha256: policy.tool.archiveSha256,
      historyRelease: policy.historyRelease,
      manifestSha256: policy.publisher.manifestSha256,
      sourceRevision: policy.selection.sourceRevision,
      version: policy.selection.version,
      matchedFiles,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.length === 2 && args[0] === '--package' && args[1]) {
      console.log(JSON.stringify(checkPackage(resolve(args[1])), null, 2));
    } else {
      if (![3, 4].includes(args.length) || args.some((arg) => !arg)) {
        throw new Error(
          'Provide staged assets, a trusted environment checkout and a pinned verifier',
        );
      }
      console.log(JSON.stringify(shadow(...args.map((path) => resolve(path))), null, 2));
    }
  } catch (error) {
    console.error(`contracts-shadow: ${error.message}`);
    process.exitCode = 1;
  }
}
