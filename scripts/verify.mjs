import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];
function check(name, operation) {
  try {
    operation();
    checks.push({ name, status: 'passed' });
  } catch (error) {
    checks.push({ name, status: 'failed', detail: error.message });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function resource(path) {
  assert(typeof path === 'string' && path.length > 0, 'Missing resource path');
  const local = relative(root, resolve(root, path));
  assert(local !== '..' && !local.startsWith(`..\\`) && !local.startsWith('../') && !isAbsolute(local), `Resource outside project: ${path}`);
  assert(statSync(resolve(root, path)).isFile(), `Not a file: ${path}`);
}
function walk(directory) {
  const ignored = new Set(['.git', '.local', 'artifacts', 'node_modules']);
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.isFile() && /\.(?:js|mjs)$/.test(entry.name) ? [path] : [];
  });
}
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

const startedAt = new Date().toISOString();
const head = git(['rev-parse', 'HEAD']);
const workingTree = git(['status', '--porcelain=v1', '--untracked-files=all']);
for (const file of walk(root).sort()) {
  check(`Syntax: ${relative(root, file).replaceAll('\\', '/')}`, () => {
    const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
    assert(result.status === 0, result.error?.message || result.stderr || `Exit code ${result.status}`);
  });
}

let manifest;
check('Manifest JSON and MV3 entry fields', () => {
  manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
  assert(manifest.manifest_version === 3, 'Expected manifest_version 3');
  assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'Missing extension name');
  assert(typeof manifest.version === 'string' && /^\d+(?:\.\d+){0,3}$/.test(manifest.version), 'Expected numeric manifest version');
  assert(manifest.background?.service_worker, 'Missing background.service_worker');
  assert(manifest.action?.default_popup, 'Missing action.default_popup');
  assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, 'Missing content_scripts');
});
if (manifest) {
  if (manifest.default_locale) check('Localized manifest messages and store locales', () => {
    const locales = readdirSync(resolve(root, '_locales'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    assert(locales.includes(manifest.default_locale), 'Default locale has no message catalog');
    const fields = [manifest.name, manifest.description, manifest.action?.default_title].filter(Boolean);
    assert(/^__MSG_.+__$/.test(manifest.name) && /^__MSG_.+__$/.test(manifest.description), 'Store name and description must reference localized messages');
    for (const locale of locales) {
      const messages = JSON.parse(readFileSync(resolve(root, '_locales', locale, 'messages.json'), 'utf8'));
      const localized = fields.map(field => field.replace(/__MSG_(\w+)__/g, (_, key) => {
        const entry = Object.entries(messages).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
        assert(typeof entry?.message === 'string' && entry.message.trim(), `Missing ${key} in ${locale}`);
        return entry.message;
      }));
      assert(localized[0].length <= 75, `Extension name exceeds 75 characters in ${locale}`);
      assert(localized[1].length <= 132, `Extension description exceeds 132 characters in ${locale}`);
    }
  });
  const paths = [manifest.background?.service_worker, manifest.action?.default_popup,
    ...(manifest.content_scripts || []).flatMap(script => [...(script.js || []), ...(script.css || [])]),
    ...Object.values(manifest.icons || {}), ...Object.values(manifest.action?.default_icon || {})];
  paths.push(...(manifest.web_accessible_resources || []).flatMap(entry => entry.resources || []));
  for (const path of new Set(paths)) check(`Manifest resource: ${path}`, () => resource(path));
}
check('Popup local script/style references and displayed version', () => {
  const html = readFileSync(resolve(root, 'popup.html'), 'utf8');
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)].map(match => match[1]);
  assert(refs.length > 0, 'No popup resource references found');
  for (const ref of refs) {
    assert(!/^(?:https?:|\/\/|data:)/i.test(ref), `Expected local popup resource: ${ref}`);
    resource(ref);
  }
  const version = html.match(/class=["']version["'][^>]*>\s*v([^<\s]+)/)?.[1];
  assert(manifest && version === manifest.version, `Popup version ${version} differs from manifest ${manifest?.version}`);
});
check('Background literal injection resources', () => {
  const source = readFileSync(resolve(root, 'background.js'), 'utf8');
  const lists = [...source.matchAll(/\bfiles\s*:\s*\[([^\]]*)\]/g)];
  assert(lists.length > 0, 'No literal injection resource lists found; review checker if injection changes');
  for (const list of lists) {
    const paths = [...list[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1]);
    assert(paths.length > 0, 'No literal paths in injection resource list');
    paths.forEach(resource);
  }
});
check('Background imported shared scripts', () => {
  const source = readFileSync(resolve(root, 'background.js'), 'utf8');
  for (const match of source.matchAll(/\bimportScripts\(\s*['"]([^'"]+)['"]\s*\)/g)) resource(match[1]);
});

const report = {
  startedAt, finishedAt: new Date().toISOString(), root, node: process.version, head, workingTree,
  scope: 'Offline static checks only; no browser launch or provider API requests',
  checks, passed: checks.filter(item => item.status === 'passed').length,
  failed: checks.filter(item => item.status === 'failed').length,
  unverified: ['Edge extension loading and rendering', 'chrome.* messaging/storage/download behavior',
    'Selection and full-page DOM interactions', 'Real provider credentials, models and streaming requests']
};
for (const item of checks) console.log(`${item.status.toUpperCase()}: ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
console.log(`Static checks: ${report.passed} passed, ${report.failed} failed`);
const args = process.argv.slice(2);
if (args.length > 0) {
  if (args.length !== 2 || args[0] !== '--report') throw new Error('Usage: node scripts/verify.mjs [--report path]');
  const path = resolve(root, args[1]);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Report: ${path}`);
}
process.exitCode = report.failed > 0 ? 1 : 0;
