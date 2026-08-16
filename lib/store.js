import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'store.json');

const EMPTY = {
  version: 1,
  tools: {},
  connections: {},
  pipelines: {},
  runs: {},
  queries: {},
  answers: {},
  canon: {},
  votes: {},
  models: {},
  events: [],
};

let db = null;
let flushTimer = null;
let counter = 0;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function load() {
  if (db) return db;
  ensureDir();
  if (!existsSync(DB_PATH)) {
    db = structuredClone(EMPTY);
    return db;
  }
  try {
    db = { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(DB_PATH, 'utf8')) };
  } catch (err) {
    console.error('[store] could not parse store.json, starting fresh:', err.message);
    db = structuredClone(EMPTY);
  }
  return db;
}

function writeNow() {
  ensureDir();
  const tmp = DB_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_PATH);
}

// Debounced so a pipeline run doesn't hit the disk once per step.
export function save() {
  if (!db || flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    writeNow();
  }, 120);
}

export function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (db) writeNow();
}

export function reset() {
  db = structuredClone(EMPTY);
  flush();
  return db;
}

export function id(prefix = 'x') {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}`;
}

export function log(type, payload) {
  const d = load();
  d.events.unshift({ id: id('ev'), type, payload, at: Date.now() });
  if (d.events.length > 500) d.events.length = 500;
  save();
}

process.on('exit', flush);
process.on('SIGINT', () => {
  flush();
  process.exit(0);
});
process.on('SIGTERM', () => {
  flush();
  process.exit(0);
});
