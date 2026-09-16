import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { buildManifest } from '../scripts/manifest.mjs';
import { digest, parseJson, root, validate, verifyWorkload } from '../scripts/contracts.mjs';

// Synthetic local evidence and storage receipts; nothing is uploaded.
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'perfeng-contract-'));
  for (const file of ['definitions/smoke/checkout.json', 'workloads/smoke/checkout.json']) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    copyFileSync(join(root, file), join(directory, file));
  }
  const runId = 'perf-20260902-120000-a1b2c3d4';
  const request = {
    runId,
    testId: 'checkout-api',
    workloadFile: 'definitions/smoke/checkout.json',
    producer: {
      name: 'k6',
      version: '2.2.0',
      artifact: {
        kind: 'oci-image',
        image: 'example.invalid/perfeng-k6@sha256:' + 'a'.repeat(64),
      },
    },
    measurementWindow: { start: '2026-09-02T12:00:00Z', end: '2026-09-02T12:02:00Z' },
    receipts: [
      {
        file: 'summary.json',
        artifact: {
          id: '11111111-1111-4111-8111-111111111111',
          runId,
          kind: 'raw',
          uri: 's3://synthetic-fixture/summary.json',
          sha256: '',
          sizeBytes: 0,
          mediaType: 'application/json',
          format: 'k6-summary-json',
        },
      },
      {
        file: 'points.jsonl',
        artifact: {
          id: '22222222-2222-4222-8222-222222222222',
          runId,
          kind: 'raw',
          uri: 's3://synthetic-fixture/points.jsonl',
          sha256: '',
          sizeBytes: 0,
          mediaType: 'application/x-ndjson',
          format: 'k6-json-points',
        },
      },
    ],
  };
  const data = [
    JSON.stringify({ metrics: { http_req_duration: { avg: 10 } } }) + '\n',
    JSON.stringify({
      type: 'Point',
      metric: 'http_req_duration',
      data: { time: '2026-09-02T12:00:01.123456789Z', value: 10, tags: {} },
    }) + '\n',
  ];
  function replace(index, bytes) {
    const receipt = request.receipts[index];
    writeFileSync(join(directory, receipt.file), bytes);
    receipt.artifact.sha256 = digest(Buffer.from(bytes));
    receipt.artifact.sizeBytes = Buffer.byteLength(bytes);
  }
  data.forEach((bytes, index) => replace(index, bytes));
  return { directory, request, replace };
}
const now = '2026-09-02T12:03:00Z';

test('all 12 workload definitions validate and match exact native bytes', () => {
  const registry = parseJson(readFileSync(join(root, 'workloads/registry.json')));
  let count = 0;
  for (const [scenario, entry] of Object.entries(registry.testScenarios)) {
    for (const profile of entry.supportedProfiles) {
      const { workload } = verifyWorkload(root, `definitions/${profile}/${scenario}.json`);
      assert.equal(workload.id, `${scenario}-${profile}`);
      assert.equal(workload.profile, profile);
      count++;
    }
  }
  assert.equal(count, 12);
});

test('manifest conforms to pinned contract, uses exact hashes, and leaves raw files unchanged', async () => {
  const { directory, request } = fixture();
  const before = request.receipts.map((r) => readFileSync(join(directory, r.file)));
  const manifest = await buildManifest(request, directory, now);
  validate('raw-result/v2/raw-result.schema.json', manifest);
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.contractsVersion, '0.13.0');
  assert.deepEqual(manifest.producer, request.producer);
  assert.equal(
    manifest.workload.sha256,
    digest(readFileSync(join(directory, request.workloadFile))),
  );
  assert.deepEqual(
    manifest.artifacts,
    request.receipts.map((r) => r.artifact),
  );
  assert(!Object.hasOwn(manifest, 'status'));
  request.receipts.forEach((r, i) =>
    assert.deepEqual(readFileSync(join(directory, r.file)), before[i]),
  );
});

for (const [label, change] of [
  [
    'wrong checksum',
    (f) => {
      f.request.receipts[0].artifact.sha256 = 'f'.repeat(64);
    },
  ],
  [
    'wrong byte count',
    (f) => {
      f.request.receipts[0].artifact.sizeBytes++;
    },
  ],
  [
    'wrong run',
    (f) => {
      f.request.receipts[0].artifact.runId = 'perf-20260902-120000-deadbeef';
    },
  ],
  [
    'duplicate ID',
    (f) => {
      f.request.receipts[1].artifact.id = f.request.receipts[0].artifact.id;
    },
  ],
  [
    'duplicate URI',
    (f) => {
      f.request.receipts[1].artifact.uri = f.request.receipts[0].artifact.uri;
    },
  ],
  [
    'duplicate format',
    (f) => {
      f.request.receipts[1].artifact.format = 'k6-summary-json';
      f.request.receipts[1].artifact.mediaType = 'application/json';
    },
  ],
  [
    'credentials in URI',
    (f) => {
      f.request.receipts[0].artifact.uri = 'https://user:password@example.invalid/file';
    },
  ],
  [
    'signed URI',
    (f) => {
      f.request.receipts[0].artifact.uri += '?signature=secret';
    },
  ],
  [
    'local URI',
    (f) => {
      f.request.receipts[0].artifact.uri = 'file:///tmp/result';
    },
  ],
  [
    'parent traversal',
    (f) => {
      f.request.receipts[0].file = '../summary.json';
    },
  ],
  [
    'normalized artifact',
    (f) => {
      f.request.receipts[0].artifact.kind = 'normalized';
    },
  ],
  [
    'floating image',
    (f) => {
      f.request.producer.artifact.image = 'example.invalid/perfeng-k6:latest';
    },
  ],
  [
    'native producer artifact',
    (f) => {
      f.request.producer.artifact = {
        kind: 'source-checkout',
        repository: 'https://github.com/example/perfeng-k6',
        gitSha: 'a'.repeat(40),
        dependencyLock: { path: 'package-lock.json', sha256: 'b'.repeat(64) },
      };
    },
  ],
  [
    'unknown producer version',
    (f) => {
      f.request.producer.version = '0.48.0';
    },
  ],
  [
    'wrong test identity',
    (f) => {
      f.request.testId = 'account-api';
    },
  ],
  [
    'missing reference',
    (f) => {
      f.request.receipts.pop();
    },
  ],
  [
    'invalid calendar date',
    (f) => {
      f.request.measurementWindow.start = '2026-02-30T00:00:00Z';
    },
  ],
  [
    'inverted window',
    (f) => {
      f.request.measurementWindow.start = '2026-09-02T12:04:00Z';
    },
  ],
  [
    'future window',
    (f) => {
      f.request.measurementWindow.end = '2026-09-02T12:04:00Z';
    },
  ],
  [
    'unsupported precision',
    (f) => {
      f.request.measurementWindow.start = '2026-09-02T12:00:00.123456Z';
    },
  ],
  [
    'unknown request field',
    (f) => {
      f.request.status = 'PASS';
    },
  ],
  ['empty raw data', (f) => f.replace(0, '')],
  ['malformed summary', (f) => f.replace(0, '{"metrics":')],
  ['missing metrics', (f) => f.replace(0, '{"metrics":{}}')],
  ['nonfinite number', (f) => f.replace(0, '{"metrics":{"x":1e999}}')],
  ['malformed points', (f) => f.replace(1, '{"type":"Point","metric":"x","data":{"value":null}}')],
  [
    'invalid point time',
    (f) =>
      f.replace(
        1,
        '{"type":"Point","metric":"x","data":{"time":"2026-02-30T12:00:01Z","value":1}}',
      ),
  ],
  ['no points', (f) => f.replace(1, '{"type":"Metric","metric":"x"}')],
  [
    'points outside window',
    (f) => {
      f.request.measurementWindow.start = '2026-09-02T12:01:00Z';
    },
  ],
]) {
  test('reject ' + label, async () => {
    const f = fixture();
    change(f);
    await assert.rejects(buildManifest(f.request, f.directory, now));
  });
}

test('reject changed configuration, budget, model, and excluded phases', () => {
  for (const change of [
    (d) => {
      d.phases.measurement++;
    },
    (d) => {
      d.phases.warmup = 10;
    },
    (d) => {
      d.model = 'closed';
    },
    (d) => {
      d.configuration.sha256 = 'f'.repeat(64);
    },
  ]) {
    const f = fixture();
    const path = join(f.directory, f.request.workloadFile);
    const definition = parseJson(readFileSync(path));
    change(definition);
    writeFileSync(path, JSON.stringify(definition));
    assert.throws(() => verifyWorkload(f.directory, f.request.workloadFile));
  }
});

test('reject symlink or junction escape from capture root', async () => {
  const f = fixture();
  const external = mkdtempSync(join(tmpdir(), 'perfeng-external-'));
  copyFileSync(join(f.directory, 'summary.json'), join(external, 'summary.json'));
  symlinkSync(
    external,
    join(f.directory, 'escape'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  f.request.receipts[0].file = 'escape/summary.json';
  await assert.rejects(buildManifest(f.request, f.directory, now), /escapes/);
});

test('CLI writes exclusively and preserves existing output on retry', () => {
  const f = fixture();
  const requestPath = join(f.directory, 'request.json');
  const output = join(f.directory, 'raw-result.json');
  writeFileSync(requestPath, JSON.stringify(f.request));
  const args = [join(root, 'scripts/manifest.mjs'), f.directory, requestPath, output];
  const first = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  const bytes = readFileSync(output);
  const second = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(second.status, 1);
  assert.deepEqual(readFileSync(output), bytes);
});
