import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const skippedDirectories = new Set([
  '.git',
  '.idea',
  '.local',
  'dist',
  'node_modules',
  'results',
  'testdata',
  'vendor',
]);
const externalScheme = /^[a-z][a-z0-9+.-]*:/i;
const inlineLink = /!?[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g;
const referenceLink = /^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|[^\s]+)/;
const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const adrFile = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const adrHeading = /^# ADR-(\d{4}): (\S.*)$/;
const adrMetadata = /^- ([A-Za-z][A-Za-z ]+):\s*(.*)$/;
const milestone = /^M\d{2} — \S.*$/;
const actionLine = /^\s*(?:-\s*)?uses:\s*(.*?)\s*$/;
const yamlBlockScalar = /^\s*(?:-\s*)?[^:#]+:\s*[|>][0-9+-]*\s*(?:#.*)?$/;

function violation(path, line, rule, message, fix, policy) {
  return { path, line, rule, message, fix, policy };
}

export function formatViolation(item) {
  return `${item.path}:${item.line}: [${item.rule}] ${item.message}; fix: ${item.fix}; policy: ${item.policy}`;
}

function slash(path) {
  return path.split(sep).join('/');
}

function discoverMarkdown(root) {
  const documents = new Map();
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (extname(entry.name).toLowerCase() === '.md') {
        const repoPath = slash(relative(root, path));
        documents.set(repoPath, parseMarkdown(repoPath, readFileSync(path, 'utf8')));
      }
    }
  }
  visit(root);
  return documents;
}

function parseMarkdown(path, text) {
  const lines = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const headings = [];
  const anchors = new Set();
  const links = [];
  const anchorCounts = new Map();
  let words = 0;
  let inFence = false;
  let fenceCharacter = '';
  let fenceWidth = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    const fence = trimmed.match(/^(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceCharacter = fence[1][0];
        fenceWidth = fence[1].length;
      } else if (fence[1][0] === fenceCharacter && fence[1].length >= fenceWidth) {
        inFence = false;
      }
      return;
    }
    if (inFence) return;

    const prose = line.replace(/`[^`]*`/g, ' ');
    words += (prose.match(/[\p{L}\p{N}]+(?:['_-][\p{L}\p{N}]+)*/gu) || []).length;
    for (const match of prose.matchAll(inlineLink)) {
      links.push({ target: cleanDestination(match[1]), line: index + 1 });
    }
    const reference = line.match(referenceLink);
    if (reference) links.push({ target: cleanDestination(reference[1]), line: index + 1 });

    const match = trimmed.match(headingPattern);
    if (!match) return;
    const heading = { level: match[1].length, text: match[2].trim(), line: index + 1 };
    headings.push(heading);
    const base = githubAnchor(heading.text);
    const count = anchorCounts.get(base) || 0;
    anchors.add(count === 0 ? base : `${base}-${count}`);
    anchorCounts.set(base, count + 1);
  });

  return { path, lines, headings, anchors, links, words };
}

function cleanDestination(value) {
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>') ? trimmed.slice(1, -1) : trimmed;
}

function githubAnchor(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function exactPathExists(root, repoPath) {
  const parts = repoPath.split(/[\\/]/).filter(Boolean);
  let current = root;
  for (const part of parts) {
    let names;
    try {
      names = readdirSync(current);
    } catch {
      return false;
    }
    if (!names.includes(part)) return false;
    current = join(current, part);
  }
  return true;
}

function checkLinks(root, documents) {
  const violations = [];
  for (const document of documents.values()) {
    for (const candidate of document.links) {
      if (
        externalScheme.test(candidate.target) ||
        candidate.target.startsWith('//') ||
        candidate.target.startsWith('mailto:')
      ) {
        continue;
      }
      let decodedPath;
      let fragment;
      try {
        const hashAt = candidate.target.indexOf('#');
        const rawPath = hashAt < 0 ? candidate.target : candidate.target.slice(0, hashAt);
        const queryAt = rawPath.indexOf('?');
        decodedPath = decodeURIComponent(
          (queryAt < 0 ? rawPath : rawPath.slice(0, queryAt)).replace(/^\//, ''),
        );
        fragment = decodeURIComponent(hashAt < 0 ? '' : candidate.target.slice(hashAt + 1));
      } catch {
        violations.push(
          violation(
            document.path,
            candidate.line,
            'docs.internal-link',
            'link contains invalid percent encoding',
            'correct its path or heading encoding',
            'CONTRIBUTING.md#documentation',
          ),
        );
        continue;
      }
      let target = candidate.target.startsWith('/')
        ? decodedPath
        : slash(join(dirname(document.path), decodedPath));
      if (!decodedPath) target = document.path;
      target = slash(target).replace(/^\.\//, '');
      const absolute = resolve(root, target);
      const inside = relative(root, absolute);
      if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
        violations.push(
          violation(
            document.path,
            candidate.line,
            'docs.internal-link',
            'link escapes the repository root',
            'link to a checked-in repository path',
            'CONTRIBUTING.md#documentation',
          ),
        );
        continue;
      }
      if (!exactPathExists(root, target)) {
        violations.push(
          violation(
            document.path,
            candidate.line,
            'docs.internal-link',
            `link ${JSON.stringify(candidate.target)} does not resolve with exact letter case`,
            'correct the relative path or capitalization',
            'CONTRIBUTING.md#documentation',
          ),
        );
        continue;
      }
      if (!fragment || !documents.has(target)) continue;
      if (!documents.get(target).anchors.has(fragment)) {
        violations.push(
          violation(
            document.path,
            candidate.line,
            'docs.internal-link',
            `link ${JSON.stringify(candidate.target)} names a missing heading`,
            'use an existing generated heading anchor',
            'CONTRIBUTING.md#documentation',
          ),
        );
      }
    }
  }
  return violations;
}

function checkSummaries(documents) {
  const violations = [];
  for (const document of documents.values()) {
    if (document.path.startsWith('.github/')) continue;
    const secondLevels = document.headings.filter((heading) => heading.level === 2);
    const lower = document.path.toLowerCase();
    const required =
      document.words >= 800 ||
      secondLevels.length > 5 ||
      lower === 'security.md' ||
      lower.includes('migration') ||
      lower.includes('operations') ||
      lower.includes('runbook');
    if (required && secondLevels[0]?.text !== 'TL;DR') {
      violations.push(
        violation(
          document.path,
          secondLevels[0]?.line || 1,
          'docs.tldr',
          'long or selectively consulted documentation does not start with `## TL;DR`',
          'add a concise TL;DR as the first second-level section',
          'CONTRIBUTING.md#documentation',
        ),
      );
    }
  }
  return violations;
}

function checkADRs(documents) {
  const records = new Map();
  const violations = [];
  for (const [path, document] of documents) {
    if (dirname(path).split(sep).join('/') !== 'docs/decisions' || path.endsWith('/README.md')) {
      continue;
    }
    const fileMatch = path.split('/').at(-1).match(adrFile);
    if (!fileMatch) {
      violations.push(
        violation(
          path,
          1,
          'adr.filename',
          'ADR filename is not four-digit kebab-case',
          'rename it and update the decision index',
          'docs/decisions/README.md#naming-and-lifecycle',
        ),
      );
      continue;
    }
    const headingMatch = document.lines[0]?.match(adrHeading);
    if (!headingMatch || headingMatch[1] !== fileMatch[1]) {
      violations.push(
        violation(
          path,
          1,
          'adr.heading',
          'ADR heading does not match its filename number',
          'use `# ADR-NNNN: Decision title`',
          'docs/decisions/README.md#naming-and-lifecycle',
        ),
      );
      continue;
    }
    const metadata = new Map();
    for (const line of document.lines.slice(1)) {
      if (line.startsWith('## ')) break;
      const match = line.trim().match(adrMetadata);
      if (match) metadata.set(match[1], match[2].trim());
    }
    for (const field of [
      'Status',
      'Date',
      'Milestone',
      'Deciders',
      'Supersedes',
      'Superseded by',
    ]) {
      if (!metadata.has(field)) {
        violations.push(
          violation(
            path,
            1,
            'adr.metadata',
            `ADR is missing ${field}`,
            'restore the canonical metadata field',
            'docs/decisions/README.md#naming-and-lifecycle',
          ),
        );
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.get('Date') || '')) {
      violations.push(
        violation(
          path,
          1,
          'adr.date',
          'ADR date is not YYYY-MM-DD',
          'use an ISO calendar date',
          'docs/decisions/README.md#naming-and-lifecycle',
        ),
      );
    }
    if (!milestone.test(metadata.get('Milestone') || '')) {
      violations.push(
        violation(
          path,
          1,
          'adr.milestone',
          'ADR milestone does not match `MNN — Outcome`',
          'use the exact published milestone title',
          'docs/decisions/README.md#naming-and-lifecycle',
        ),
      );
    }
    records.set(fileMatch[1], {
      path,
      title: headingMatch[2].trim(),
      status: metadata.get('Status'),
    });
  }

  [...records.keys()].sort().forEach((number, index) => {
    const expected = String(index + 1).padStart(4, '0');
    if (number !== expected) {
      violations.push(
        violation(
          'docs/decisions/README.md',
          1,
          'adr.sequence',
          `ADR sequence expected ${expected} but found ${number}`,
          'renumber an unpublished collision or restore the record',
          'docs/decisions/README.md#naming-and-lifecycle',
        ),
      );
    }
  });

  const indexDocument = documents.get('docs/decisions/README.md');
  for (const [number, record] of records) {
    const row = indexDocument?.lines.find((line) => line.startsWith(`| [${number}](`));
    if (!row || !row.includes(`| ${record.title} | ${record.status} |`)) {
      violations.push(
        violation(
          record.path,
          1,
          'adr.index',
          'ADR is missing or inconsistent in the decision index',
          'add its exact number, link, title, and status',
          'docs/decisions/README.md#naming-and-lifecycle',
        ),
      );
    }
  }
  return violations;
}

function checkTemplates(documents) {
  const checks = [
    {
      path: '.github/ISSUE_TEMPLATE/work-item.md',
      rule: 'template.issue',
      policy: 'CONTRIBUTING.md#milestones-and-required-issue',
      required: [
        '**Repository:** perfeng-k6',
        '**Milestone:** MNN — Outcome',
        '## Goal',
        '## Scope',
        '## Design decisions',
        '## Security and operations',
        '## Acceptance criteria',
        '## Verification',
        '## Out of scope',
      ],
    },
    {
      path: '.github/PULL_REQUEST_TEMPLATE.md',
      rule: 'template.pull-request',
      policy: 'CONTRIBUTING.md#pull-request-description',
      required: [
        '## Linked work',
        '## Outcome and scope',
        '## Design, compatibility and operations',
        '## Verification',
        'Checks not run, blocking reason and residual risk:',
        '## Limitations and review',
      ],
    },
  ];
  const violations = [];
  for (const check of checks) {
    const document = documents.get(check.path);
    if (!document) {
      violations.push(
        violation(
          check.path,
          1,
          check.rule,
          'required template is missing',
          'restore it',
          check.policy,
        ),
      );
      continue;
    }
    const content = document.lines.join('\n');
    let position = 0;
    for (const required of check.required) {
      const next = content.indexOf(required, position);
      if (next < 0) {
        violations.push(
          violation(
            check.path,
            1,
            check.rule,
            `template is missing or reorders ${required}`,
            'restore the canonical field order',
            check.policy,
          ),
        );
        break;
      }
      position = next + required.length;
    }
  }
  return violations;
}

function discoverActionFiles(root) {
  const paths = [];

  function visit(directory, candidate) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path, candidate);
      else if (candidate(entry.name)) paths.push(path);
    }
  }

  visit(join(root, '.github/workflows'), (name) => ['.yml', '.yaml'].includes(extname(name)));
  visit(join(root, '.github/actions'), (name) => ['action.yml', 'action.yaml'].includes(name));
  return [...new Set(paths)].sort();
}

function actionReferences(text) {
  const references = [];
  let blockIndent;
  for (const [index, line] of text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .entries()) {
    const indent = line.match(/^\s*/)[0].length;
    if (blockIndent !== undefined) {
      if (!line.trim() || indent > blockIndent) continue;
      blockIndent = undefined;
    }
    const match = line.match(actionLine);
    if (match) {
      let reference = match[1].trim();
      if (reference.startsWith("'") || reference.startsWith('"')) {
        const quote = reference[0];
        let closing = -1;
        for (let position = 1; position < reference.length; position += 1) {
          if (quote === '"' && reference[position] === '\\') {
            position += 1;
            continue;
          }
          if (reference[position] === quote) {
            closing = position;
            break;
          }
        }
        reference = closing >= 0 ? reference.slice(1, closing) : reference;
      } else {
        reference = reference.replace(/\s*#.*$/, '').trim();
      }
      references.push({ reference, line: index + 1 });
      continue;
    }
    if (yamlBlockScalar.test(line)) {
      blockIndent = indent;
    }
  }
  return references;
}

function checkActions(root) {
  const violations = [];
  for (const path of discoverActionFiles(root)) {
    for (const item of actionReferences(readFileSync(path, 'utf8'))) {
      if (item.reference.startsWith('./') || item.reference.startsWith('docker://')) continue;
      const separator = item.reference.lastIndexOf('@');
      if (separator > 0 && /^v\d+$/.test(item.reference.slice(separator + 1))) continue;
      violations.push(
        violation(
          slash(relative(root, path)),
          item.line,
          'workflow.action-version',
          `action reference ${JSON.stringify(item.reference)} is not a semantic major tag`,
          'use `owner/action@vN`; keep immutable hashes in product artifact and deployment fields',
          'docs/development/dependency-policy.md#automation-and-immutable-pins',
        ),
      );
    }
  }
  return violations;
}

export function checkRepository(root) {
  const resolvedRoot = resolve(root);
  if (!statSync(resolvedRoot).isDirectory()) throw new Error('repository root is not a directory');
  const documents = discoverMarkdown(resolvedRoot);
  return [
    ...checkLinks(resolvedRoot, documents),
    ...checkSummaries(documents),
    ...checkADRs(documents),
    ...checkTemplates(documents),
    ...checkActions(resolvedRoot),
  ].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.rule.localeCompare(right.rule),
  );
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const root = process.argv[2] || fileURLToPath(new URL('../', import.meta.url));
    const violations = checkRepository(root);
    violations.forEach((item) => process.stderr.write(formatViolation(item) + '\n'));
    if (violations.length) {
      process.stderr.write(`repo-check: found ${violations.length} policy violation(s)\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write('repo-check: repository policy checks passed\n');
    }
  } catch (error) {
    process.stderr.write(`repo-check: ${error.message}\n`);
    process.exitCode = 2;
  }
}
