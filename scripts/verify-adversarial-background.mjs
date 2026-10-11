// Deterministic, offline reproductions of R05/R09. Confirmed defects mean this
// reproduction succeeded; a missing reproduction or a broken check exits nonzero.
// Actual config.js/background.js run in a VM; AIConfig.load is never replaced.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = process.argv.indexOf('--report');
const reportPath = resolve(root, argument < 0
  ? 'artifacts/qa/adversarial-validation-2026-10-11/background/results.json'
  : process.argv[argument + 1]);
const event = () => ({
  listeners: [],
  addListener(listener) { this.listeners.push(listener); },
  emit(...args) { for (const listener of this.listeners) listener(...args); }
});
function deferred() {
  let resolvePromise, rejectPromise;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}
const sourceFiles = ['model-catalog.js', 'config.js', 'background.js'];
const sources = Object.fromEntries(sourceFiles.map(name => [name, readFileSync(resolve(root, name), 'utf8')]));

function harness() {
  let storage = {}, nextReadGate = null;
  const changed = event(), calls = [], timeline = [], storageWrites = [], timers = new Set();
  const fetchStarted = deferred();
  let fetchImplementation = async () => new Response(
    'data: {"choices":[{"delta":{"content":"Synthetic complete output."}}]}\n\ndata: [DONE]\n');
  const chrome = {
    runtime: { onInstalled: event(), onMessage: event(), onConnect: event() },
    contextMenus: { onClicked: event() },
    storage: { onChanged: changed, local: {
      async get(keys) {
        // Capture at call time, then delay delivery. A later storage.set cannot
        // rewrite this already-read snapshot, as with a real asynchronous read.
        const snapshot = structuredClone(storage);
        const gate = nextReadGate;
        nextReadGate = null;
        timeline.push({ event: 'storage.get:start', held: Boolean(gate), keys });
        if (gate) { gate.started.resolve(); await gate.delivery.promise; }
        timeline.push({ event: 'storage.get:deliver', held: Boolean(gate) });
        if (keys == null) return snapshot;
        if (typeof keys === 'string') return { [keys]: snapshot[keys] };
        if (Array.isArray(keys)) return Object.fromEntries(keys.filter(key => key in snapshot).map(key => [key, snapshot[key]]));
        return { ...keys, ...Object.fromEntries(Object.keys(keys).filter(key => key in snapshot).map(key => [key, snapshot[key]])) };
      },
      async set(values) {
        const changes = Object.fromEntries(Object.entries(values).map(([key, value]) =>
          [key, { oldValue: structuredClone(storage[key]), newValue: structuredClone(value) }]));
        Object.assign(storage, structuredClone(values));
        const keys = Object.keys(values);
        storageWrites.push(keys);
        timeline.push({ event: 'storage.set+onChanged', keys });
        changed.emit(changes, 'local');
      },
      async remove(keys) {
        const changes = {};
        for (const key of keys) { changes[key] = { oldValue: storage[key] }; delete storage[key]; }
        if (keys.length) changed.emit(changes, 'local');
      }
    } }
  };
  const context = vm.createContext({
    chrome, URL, AbortController, AbortSignal, TextEncoder, TextDecoder, console,
    setTimeout(callback, delay, ...args) {
      const timer = setTimeout(() => { timers.delete(timer); callback(...args); }, delay);
      timers.add(timer); return timer;
    },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
    async fetch(url, options) {
      const call = { url, options };
      calls.push(call);
      timeline.push({ event: 'fetch:start', url, aborted: options.signal.aborted });
      fetchStarted.resolve(call);
      return fetchImplementation(url, options);
    }
  });
  context.importScripts = name => {
    assert.ok(Object.hasOwn(sources, name), `Unexpected importScripts: ${name}`);
    return vm.runInContext(sources[name], context, { filename: name });
  };
  vm.runInContext(sources['background.js'], context, { filename: 'background.js' });
  const run = code => vm.runInContext(code, context);
  function fixture(label) {
    context.fixtureInput = {
      apiConfigVersion: 1, modelCatalogVersion: 1, providerConfigVersion: 1,
      modelList: ['old-chat', 'new-chat'],
      explainModel: `${label}-chat`, translateModel: `${label}-chat`,
      explainManufacturer: 'custom', translateManufacturer: 'custom',
      language: label === 'old' ? 'zh' : 'en', targetLanguage: label === 'old' ? 'zh' : 'ja',
      providerConnections: { custom: {
        apiBaseUrl: `https://${label}.synthetic.example/v1`, apiKey: `synthetic-${label}-key`,
        availableModels: [`${label}-chat`]
      } }
    };
    return structuredClone(run('AIConfig.migrate(fixtureInput)'));
  }
  function holdNextRead() {
    const gate = { started: deferred(), delivery: deferred() };
    nextReadGate = gate;
    return { started: gate.started.promise, release: () => gate.delivery.resolve() };
  }
  function port() {
    return {
      onDisconnect: event(), messages: [], closed: false,
      postMessage(message) {
        if (this.closed) throw new Error('Synthetic port already disconnected');
        this.messages.push(message);
      },
      disconnect() {
        if (this.closed) return;
        this.closed = true;
        timeline.push({ event: 'port:disconnect', listenerCount: this.onDisconnect.listeners.length });
        this.onDisconnect.emit();
      }
    };
  }
  return { run, context, calls, timeline, storageWrites, fixture, holdNextRead, port,
    fetchStarted: fetchStarted.promise,
    setFixture(value) { storage = structuredClone(value); },
    changeFixture(value) { return chrome.storage.local.set(value); },
    setFetch(implementation) { fetchImplementation = implementation; },
    dispose() { for (const timer of timers) clearTimeout(timer); timers.clear(); }
  };
}
function fields(config) {
  const connection = config.providerConnections.custom;
  return {
    explainManufacturer: config.explainManufacturer, explainModel: config.explainModel,
    language: config.language, targetLanguage: config.targetLanguage,
    apiBaseUrl: connection.apiBaseUrl,
    credentialFixture: connection.apiKey === 'synthetic-old-key' ? 'old synthetic credential'
      : connection.apiKey === 'synthetic-new-key' ? 'new synthetic credential' : 'unexpected credential'
  };
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: fixture deadline exceeded`)), 3000);
    })]);
  } finally { clearTimeout(timer); }
}
const results = [], controls = [];
async function check(id, name, operation, isControl = false) {
  const env = harness();
  try {
    const evidence = await operation(env);
    const matched = evidence.matched;
    delete evidence.matched;
    (isControl ? controls : results).push({ id, name,
      status: isControl ? (matched ? 'passed' : 'failed') : (matched ? 'confirmed' : 'not_reproduced'),
      evidence, timeline: env.timeline });
  } catch (error) {
    (isControl ? controls : results).push({ id, name, status: 'check_failed', error: error.stack,
      timeline: env.timeline });
  } finally { env.dispose(); }
}

await check('R05', 'A storage change during an old AIConfig.load repopulates stale configCache', async env => {
  const oldConfig = env.fixture('old'), newConfig = env.fixture('new');
  env.setFixture(oldConfig);
  const gate = env.holdNextRead();
  const pending = env.run('getConfig()');
  await bounded(gate.started, 'R05 old snapshot captured');
  await env.changeFixture(newConfig);
  gate.release();
  const initial = await bounded(pending, 'R05 old load completes');
  const next = await env.run('getConfig()');
  const observed = fields(next), expected = fields(newConfig);
  assert.equal(env.storageWrites.length, 1, 'Unexpected migration storage writes would confound this race');
  return { matched: observed.apiBaseUrl === fields(oldConfig).apiBaseUrl && observed.explainModel === 'old-chat',
    oldReadResult: fields(initial), nextRequestConfig: observed, currentStorageConfig: expected,
    currentStorageMatchesNextRequest: JSON.stringify(observed) === JSON.stringify(expected),
    storageReads: env.timeline.filter(item => item.event === 'storage.get:start').length,
    migrationStorageWrites: 0 };
});

await check('R05-control', 'A change after load completion invalidates an already-filled cache', async env => {
  env.setFixture(env.fixture('old'));
  const first = await env.run('getConfig()');
  const newConfig = env.fixture('new');
  await env.changeFixture(newConfig);
  const next = await env.run('getConfig()');
  return { matched: JSON.stringify(fields(next)) === JSON.stringify(fields(newConfig)),
    initial: fields(first), observed: fields(next), expected: fields(newConfig),
    storageReads: env.timeline.filter(item => item.event === 'storage.get:start').length };
}, true);

await check('R09', 'Disconnect before a deferred config read completes still starts generation', async env => {
  env.setFixture(env.fixture('old'));
  const gate = env.holdNextRead(), port = env.port();
  env.context.testPort = port;
  const pending = env.run("handleStreamRequest(testPort, {mode:'C',text:'Synthetic input'})")
    .then(() => null, error => error.message);
  await bounded(gate.started, 'R09 config read captured');
  const listenerCountAtCancel = port.onDisconnect.listeners.length;
  port.disconnect();
  gate.release();
  const terminalError = await bounded(pending, 'R09 request settles');
  const call = env.calls[0];
  assert.equal(env.storageWrites.length, 0, 'Unexpected fixture migration write');
  return { matched: listenerCountAtCancel === 0 && env.calls.length === 1 && !call.options.signal.aborted,
    listenerCountAtCancel, listenerCountAfterLoad: port.onDisconnect.listeners.length,
    fetchCalls: env.calls.length, endpoint: call?.url,
    signalAbortedAfterCancelledRequest: call?.options.signal.aborted,
    postedMessages: port.messages, terminalError, migrationStorageWrites: 0 };
});

await check('R09-control', 'Disconnect after generation starts aborts the installed controller', async env => {
  env.setFixture(env.fixture('old'));
  env.setFetch(async (_, options) => new Promise((resolvePromise, reject) => {
    const abort = () => reject(options.signal.reason);
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) abort();
  }));
  const port = env.port();
  env.context.testPort = port;
  const pending = env.run("handleStreamRequest(testPort, {mode:'C',text:'Synthetic input'})")
    .then(() => null, error => error.message);
  const call = await bounded(env.fetchStarted, 'R09-control fetch begins');
  const listenerCountAtCancel = port.onDisconnect.listeners.length;
  port.disconnect();
  const terminalError = await bounded(pending, 'R09-control cancellation settles');
  return { matched: listenerCountAtCancel === 1 && call.options.signal.aborted && terminalError === null,
    listenerCountAtCancel, fetchCalls: env.calls.length, signalAborted: call.options.signal.aborted,
    postedMessages: port.messages, terminalError };
}, true);

const success = results.every(result => result.status === 'confirmed') && controls.every(control => control.status === 'passed');
const report = {
  date: new Date().toISOString(), node: process.version, head: git(['rev-parse', 'HEAD']),
  branch: git(['branch', '--show-current']), workingTree: git(['status', '--porcelain=v1', '--untracked-files=all']),
  kind: 'Offline Node VM with actual config.js/background.js, synthetic storage snapshots, credentials, ports and fetch; no network',
  unchangedProductSources: Object.fromEntries(sourceFiles.map(name => [name, createHash('sha256').update(sources[name]).digest('hex')])),
  statusMeaning: { confirmed: 'Defect reproduced; this reproduction check succeeded', not_reproduced: 'Fixture ran but expected defect was absent', check_failed: 'Fixture/assertion/runtime failed; no defect conclusion' },
  success, results, controls,
  unverified: ['Real Edge service worker scheduling and chrome.storage event delivery', 'Real provider response, credentials, or billing']
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ report: relative(root, reportPath).replaceAll('\\', '/'), success,
  results: results.map(({ id, status }) => ({ id, status })), controls: controls.map(({ id, status }) => ({ id, status })) }, null, 2));
if (!success) process.exitCode = 1;
