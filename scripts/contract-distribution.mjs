import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { containedFile, digest, lock, parseJson, root } from './contracts.mjs';

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

function shadow(assets, bootstrap, verifier) {
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
    return {
      status: 'passed',
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
    if (args.length !== 3 || args.some((arg) => !arg)) {
      throw new Error(
        'Provide staged assets, a trusted environment checkout and a pinned verifier',
      );
    }
    console.log(JSON.stringify(shadow(...args.map((path) => resolve(path))), null, 2));
  } catch (error) {
    console.error(`contracts-shadow: ${error.message}`);
    process.exitCode = 1;
  }
}
