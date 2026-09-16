import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function parseJson(bytes) {
  return JSON.parse(bytes.toString(), (_, value) => {
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new Error('Non-finite JSON number');
    return value;
  });
}
export function containedFile(directory, name) {
  if (!/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[A-Za-z0-9_./-]+$/.test(name)) {
    throw new Error('Unsafe relative file path');
  }
  const base = realpathSync(directory);
  const file = realpathSync(resolve(base, name));
  const rel = relative(base, file);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) {
    throw new Error('File escapes capture root');
  }
  return file;
}
export const lock = parseJson(readFileSync(resolve(root, 'contracts.lock.json')));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
for (const [path, expected] of Object.entries(lock.files)) {
  const bytes = readFileSync(containedFile(resolve(root, 'vendor/contracts'), path));
  if (digest(bytes) !== expected) throw new Error(`Contract snapshot checksum mismatch: ${path}`);
  if (path.endsWith('.json')) ajv.addSchema(parseJson(bytes));
}
export const schemaId = (name) => `https://perfeng.dev/schemas/${name}`;
export function validate(name, data) {
  if (!ajv.validate(schemaId(name), data)) throw new Error(ajv.errorsText(ajv.errors));
}
export function compile(schema) {
  return ajv.compile(schema);
}

function seconds(text) {
  if (typeof text !== 'string' || !/^(?:\d+(?:h|m|s))+$/.test(text))
    throw new Error('Unsupported duration');
  return [...text.matchAll(/(\d+)(h|m|s)/g)].reduce(
    (sum, [, n, unit]) => sum + Number(n) * { h: 3600, m: 60, s: 1 }[unit],
    0,
  );
}
export function verifyWorkload(directory, definitionPath) {
  const bytes = readFileSync(containedFile(directory, definitionPath));
  const workload = parseJson(bytes);
  validate('workload/v1/workload.schema.json', workload);
  if (
    workload.tool !== 'k6' ||
    workload.dataset.kind !== 'none' ||
    workload.phases.warmup !== 0 ||
    workload.phases.cooldown !== 0
  ) {
    throw new Error('This adapter supports k6 with no versioned dataset or excluded phases');
  }
  const configuration = readFileSync(containedFile(directory, workload.configuration.path));
  if (digest(configuration) !== workload.configuration.sha256)
    throw new Error('Configuration checksum mismatch');
  const config = parseJson(configuration);
  const scenarios = Object.values(config.scenarios || {});
  if (scenarios.length !== 1) throw new Error('Expected one native scenario');
  const scenario = scenarios[0];
  const models = {
    'ramping-arrival-rate': 'open',
    'constant-arrival-rate': 'open',
    'ramping-vus': 'closed',
  };
  if (!Object.hasOwn(models, scenario.executor) || models[scenario.executor] !== workload.model) {
    throw new Error('Unsupported executor or workload model mismatch');
  }
  if (scenario.startTime && seconds(scenario.startTime) !== 0)
    throw new Error('Delayed scenarios unsupported');
  const duration =
    scenario.executor === 'constant-arrival-rate'
      ? seconds(scenario.duration)
      : scenario.stages.reduce((sum, stage) => sum + seconds(stage.duration), 0);
  if (duration !== workload.phases.measurement)
    throw new Error('Measurement budget differs from native profile');
  return { workload, sha256: digest(bytes) };
}
