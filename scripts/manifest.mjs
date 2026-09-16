import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compile,
  containedFile,
  lock,
  parseJson,
  root,
  schemaId,
  validate,
  verifyWorkload,
} from './contracts.mjs';

const raw = schemaId('raw-result/v2/raw-result.schema.json');
const validTimestamp = compile({ type: 'string', format: 'date-time' });
const requestValidator = compile({
  type: 'object',
  additionalProperties: false,
  required: ['runId', 'testId', 'workloadFile', 'producer', 'measurementWindow', 'receipts'],
  properties: {
    runId: { $ref: raw + '#/properties/runId' },
    testId: { $ref: raw + '#/properties/testId' },
    workloadFile: { type: 'string' },
    producer: { $ref: raw + '#/properties/producer' },
    measurementWindow: { $ref: raw + '#/properties/measurementWindow' },
    receipts: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['file', 'artifact'],
        properties: {
          file: { type: 'string' },
          artifact: { $ref: schemaId('artifact/v1/artifact-reference.schema.json') },
        },
      },
    },
  },
});
export function instant(text) {
  // Do not silently truncate contract timestamps with microsecond precision.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text)) {
    throw new Error('Adapter requires UTC timestamps with at most millisecond precision');
  }
  const time = Date.parse(text);
  if (!Number.isFinite(time)) throw new Error('Invalid timestamp');
  return time;
}
function location(uri) {
  const url = new URL(uri);
  if (
    !['s3:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /[?#\\]/.test(uri)
  ) {
    throw new Error('Artifact URI must be a stable S3/HTTPS location without credentials');
  }
  return url.href;
}
async function fileDigest(path) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const bytes of createReadStream(path)) {
    hash.update(bytes);
    size += bytes.length;
  }
  return { sha256: hash.digest('hex'), sizeBytes: size };
}
export async function buildManifest(request, directory, now = new Date().toISOString()) {
  if (!requestValidator(request))
    throw new Error('Invalid manifest request: ' + JSON.stringify(requestValidator.errors));
  const start = instant(request.measurementWindow.start);
  const end = instant(request.measurementWindow.end);
  if (!(start < end) || instant(now) < end) throw new Error('Invalid measurement window');
  const { workload, sha256 } = verifyWorkload(directory, request.workloadFile);
  if (
    !['checkout-api', 'search-api', 'account-api'].includes(request.testId) ||
    workload.id !== request.testId.slice(0, -4) + '-' + workload.profile
  ) {
    throw new Error('Test identity does not match workload');
  }
  if (
    request.producer.name !== 'k6' ||
    request.producer.version !== readFileSync(resolve(root, '.k6-version'), 'utf8').trim() ||
    request.producer.artifact.kind !== 'oci-image'
  ) {
    throw new Error('Unsupported capture producer/version');
  }
  const ids = new Set(),
    uris = new Set(),
    paths = new Set(),
    formats = new Set();
  const artifacts = [];
  for (const receipt of request.receipts) {
    const artifact = receipt.artifact;
    const uri = location(artifact.uri);
    const path = containedFile(directory, receipt.file);
    const types = {
      'k6-summary-json': 'application/json',
      'k6-json-points': 'application/x-ndjson',
    };
    if (
      artifact.runId !== request.runId ||
      artifact.kind !== 'raw' ||
      !Object.hasOwn(types, artifact.format) ||
      artifact.mediaType !== types[artifact.format]
    ) {
      throw new Error('Receipt does not describe a supported raw artifact for this run');
    }
    if (
      ids.has(artifact.id.toLowerCase()) ||
      uris.has(uri) ||
      paths.has(path) ||
      formats.has(artifact.format)
    ) {
      throw new Error('Duplicate artifact identity, URI, file, or format');
    }
    ids.add(artifact.id.toLowerCase());
    uris.add(uri);
    paths.add(path);
    formats.add(artifact.format);
    const actual = await fileDigest(path);
    if (
      actual.sha256 !== artifact.sha256 ||
      actual.sizeBytes !== artifact.sizeBytes ||
      actual.sizeBytes === 0
    ) {
      throw new Error('Artifact checksum/size mismatch or empty artifact');
    }
    if (artifact.format === 'k6-summary-json') {
      const summary = parseJson(readFileSync(path));
      if (
        !summary.metrics ||
        typeof summary.metrics !== 'object' ||
        Array.isArray(summary.metrics) ||
        Object.keys(summary.metrics).length === 0
      ) {
        throw new Error('Missing summary metrics');
      }
    } else {
      let observed = false;
      const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
      try {
        for await (const line of lines) {
          if (!line.trim()) continue;
          const record = parseJson(line);
          if (record.type === 'Point') {
            if (
              !record.data ||
              typeof record.data.value !== 'number' ||
              !Number.isFinite(record.data.value) ||
              typeof record.metric !== 'string'
            ) {
              throw new Error('Malformed metric point');
            }
            // k6 raw timestamps can have nanoseconds; Date.parse is used only
            // for a coarse overlap check, never to invent a phase boundary.
            const time = Date.parse(record.data.time);
            if (!validTimestamp(record.data.time) || !Number.isFinite(time))
              throw new Error('Malformed point timestamp');
            if (time >= start && time < end) observed = true;
          } else if (record.type !== 'Metric') throw new Error('Unknown k6 record type');
        }
      } finally {
        lines.close();
      }
      if (!observed) throw new Error('No measurement points in the supplied window');
    }
    artifacts.push({ ...artifact });
  }
  const result = {
    schemaVersion: 2,
    kind: 'RawResult',
    contractsVersion: lock.version,
    runId: request.runId,
    testId: request.testId,
    workload: { id: workload.id, version: workload.version, sha256 },
    producer: request.producer,
    measurementWindow: request.measurementWindow,
    createdAt: now,
    artifacts,
  };
  validate('raw-result/v2/raw-result.schema.json', result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 5)
      throw new Error('Usage: node scripts/manifest.mjs CAPTURE_ROOT REQUEST_JSON NEW_OUTPUT_JSON');
    const [, , directory, requestFile, output] = process.argv;
    const request = parseJson(readFileSync(requestFile));
    const manifest = await buildManifest(request, directory);
    writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
