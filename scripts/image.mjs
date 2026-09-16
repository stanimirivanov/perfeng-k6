import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, verifyWorkload } from './contracts.mjs';

function docker(args) {
  const result = spawnSync('docker', args, {
    cwd: root,
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error('Docker ' + args[0] + ' failed; inspect the local Docker environment');
  return result.stdout;
}

export function validateImageName(image) {
  if (
    typeof image !== 'string' ||
    image.includes('://') ||
    !/^[a-z0-9][a-z0-9./:@_-]*$/.test(image)
  ) {
    throw new Error('Expected a Docker image name, not command options or a URL');
  }
}

export function inventory(directory = root) {
  const hashes = {};
  function add(path) {
    const status = lstatSync(resolve(directory, path));
    if (!status.isFile() || status.isSymbolicLink())
      throw new Error('Image input is not an ordinary file');
    hashes[path] = createHash('sha256')
      .update(readFileSync(resolve(directory, path)))
      .digest('hex');
  }
  function walk(path) {
    const status = lstatSync(resolve(directory, path));
    if (!status.isDirectory() || status.isSymbolicLink())
      throw new Error('Image input directory is redirected');
    for (const entry of readdirSync(resolve(directory, path), { withFileTypes: true })) {
      const name = path + '/' + entry.name;
      if (!/^[a-zA-Z0-9_./-]+$/.test(name) || entry.isSymbolicLink()) {
        throw new Error('Image inputs must be ordinary files with portable paths');
      }
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) add(name);
      else throw new Error('Unsupported image input');
    }
  }
  ['lib', 'tests', 'workloads', 'definitions'].forEach(walk);
  add('.k6-version');
  return hashes;
}

export function parseHashes(text) {
  const hashes = {};
  for (const line of text.trim().split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})  ([a-zA-Z0-9_./-]+)$/.exec(line);
    if (!match || Object.hasOwn(hashes, match[2])) throw new Error('Invalid image inventory');
    hashes[match[2]] = match[1];
  }
  return hashes;
}

export function publishedReference(repoDigests, repository) {
  if (!/^ghcr\.io\/[a-z0-9_-]+\/perfeng-k6$/.test(repository)) {
    throw new Error('Expected the runner GHCR repository');
  }
  const matches = (repoDigests || []).filter(
    (value) => typeof value === 'string' && value.startsWith(repository + '@sha256:'),
  );
  if (matches.length !== 1 || !/^[^@]+@sha256:[0-9a-f]{64}$/.test(matches[0])) {
    throw new Error(
      'A unique published registry digest is required; a local image ID is not sufficient',
    );
  }
  return matches[0];
}

export function verifyImage(image, revision) {
  validateImageName(image);
  const [metadata] = JSON.parse(docker(['image', 'inspect', image]).toString('utf8'));
  assert.equal(metadata.Os, 'linux');
  assert.equal(metadata.Config.User, '12345:12345');
  assert.equal(metadata.Config.WorkingDir, '/tests');
  assert.deepEqual(metadata.Config.Entrypoint, ['k6']);
  assert.equal(metadata.Config.Labels['org.opencontainers.image.title'], 'perfeng-k6');
  if (revision) assert.equal(metadata.Config.Labels['org.opencontainers.image.revision'], revision);
  const restricted = [
    'run',
    '--rm',
    '--network',
    'none',
    '--read-only',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
  ];
  const version = readFileSync(resolve(root, '.k6-version'), 'utf8').trim();
  const actualVersion = docker([...restricted, image, 'version']).toString('utf8');
  assert.equal(actualVersion.split(/\s+/)[1], 'v' + version);
  const actual = parseHashes(
    docker([
      ...restricted,
      '--entrypoint',
      '/bin/sh',
      image,
      '-ec',
      'cd /tests; find lib tests workloads definitions -type f -exec sha256sum {} \\; ; sha256sum .k6-version',
    ]).toString('utf8'),
  );
  assert.deepEqual(actual, inventory());
  const registry = JSON.parse(readFileSync(resolve(root, 'workloads/registry.json'), 'utf8'));
  let count = 0;
  for (const [scenario, entry] of Object.entries(registry.testScenarios)) {
    for (const profile of entry.supportedProfiles) {
      verifyWorkload(root, 'definitions/' + profile + '/' + scenario + '.json');
      docker([
        ...restricted,
        image,
        'inspect',
        '--execution-requirements',
        '--config',
        'workloads/' + profile + '/' + scenario + '.json',
        'tests/' + scenario + '/scenario.js',
      ]);
      count++;
    }
  }
  console.log(
    'Verified image: k6 ' +
      version +
      ', non-root runtime, exact packaged bytes, ' +
      count +
      ' workloads.',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, image, extra] = process.argv.slice(2);
    validateImageName(image);
    if (action === 'verify') verifyImage(image, extra);
    else if (action === 'reference') {
      const [metadata] = JSON.parse(docker(['image', 'inspect', image]).toString('utf8'));
      console.log(publishedReference(metadata.RepoDigests, extra));
    } else
      throw new Error('Usage: image.mjs verify IMAGE [REVISION] | reference IMAGE GHCR_REPOSITORY');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
