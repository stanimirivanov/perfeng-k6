import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

function moduleSpecifiers(source) {
  const tree = parse(source, {
    allowHashBang: true,
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
  const specifiers = [];
  const pending = [tree];
  while (pending.length > 0) {
    const node = pending.pop();
    if (
      (node.type === 'ImportDeclaration' ||
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportAllDeclaration') &&
      typeof node.source?.value === 'string'
    ) {
      specifiers.push(node.source.value);
    } else if (node.type === 'ImportExpression' && typeof node.source?.value === 'string') {
      specifiers.push(node.source.value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object' && typeof child.type === 'string')
            pending.push(child);
        }
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        pending.push(value);
      }
    }
  }
  return specifiers;
}

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function inspectRuntimeSource(root, file, source) {
  const violations = [];
  const runtimeRoots = [resolve(root, 'lib'), resolve(root, 'tests')];
  let specifiers;
  try {
    specifiers = moduleSpecifiers(source);
  } catch (error) {
    return [`${relative(root, file)} is not valid JavaScript: ${error.message}`];
  }
  for (const specifier of specifiers) {
    if (specifier === 'k6' || specifier.startsWith('k6/')) continue;
    if (!specifier.startsWith('.')) {
      violations.push(
        `${relative(root, file)} imports Node/npm module ${JSON.stringify(specifier)}`,
      );
      continue;
    }
    const target = resolve(dirname(file), specifier);
    if (!runtimeRoots.some((runtimeRoot) => inside(runtimeRoot, target))) {
      violations.push(
        `${relative(root, file)} imports tooling or escapes runtime roots via ${JSON.stringify(specifier)}`,
      );
      continue;
    }
    if (!existsSync(target)) {
      violations.push(
        `${relative(root, file)} imports missing runtime module ${JSON.stringify(specifier)}`,
      );
    }
  }
  return violations;
}

export function checkRuntimeArchitecture(root) {
  const violations = [];
  for (const runtimeRoot of ['lib', 'tests']) {
    const directory = resolve(root, runtimeRoot);
    if (!existsSync(directory)) {
      violations.push(`runtime source root ${runtimeRoot} is missing`);
      continue;
    }
    for (const file of sourceFiles(directory)) {
      violations.push(...inspectRuntimeSource(root, file, readFileSync(file, 'utf8')));
    }
  }
  return violations.sort();
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const root = process.argv[2]
    ? resolve(process.argv[2])
    : fileURLToPath(new URL('../', import.meta.url));
  const violations = checkRuntimeArchitecture(root);
  if (violations.length) {
    violations.forEach((item) =>
      process.stderr.write(
        `architecture-check: ${item}; fix: keep k6 runtime imports within lib/tests and k6 modules\n`,
      ),
    );
    process.exitCode = 1;
  } else {
    process.stdout.write('architecture-check: k6 runtime/tooling boundary passed\n');
  }
}
