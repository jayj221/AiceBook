// Zero-dependency JSON store. Atomic writes, in-memory working set.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'store.json');

const EMPTY = {
  version: 1,
  tools: {},        // slug -> tool record (registry, grows at runtime)
  connections: {},  // userId -> { provider: {status, keyRef, plan, addedAt} }
  pipelines: {},    // id -> pipeline
  runs: {},         // id -> run
  queries: {},      // id -> query (Exchange)
  answers: {},      // id -> answer
  canon: {},        // id -> promoted answer, the fast path
  votes: {},        // `${voter}:${targetId}` -> 1 | -1
  models: {},       // modelId -> reputation record
  events: [],       // append-only activity log (capped)
};

let db = null;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function load() {
  if (db) return db;
  ensureDir();
  if (existsSync(DB_PATH)) {
    try {
      db = { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(DB_PATH, 'utf8')) };
    } catch (err) {
      console.error('[store] corrupt store.json, starting fresh:', err.message);
      db = structuredClone(EMPTY);
    }
  } else {
    db = structuredClone(EMPTY);
  }
  return db;
}

let flushTimer = null;
export function save() {
  if (!db) return;
  // Debounce: bursty writes during a pipeline run shouldn't hit disk each time.
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    ensureDir();
    const tmp = DB_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(db, null, 2));
    renameSync(tmp, DB_PATH);
  }, 120);
}

export function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!db) return;
  ensureDir();
  const tmp = DB_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_PATH);
}

export function reset() {
  db = structuredClone(EMPTY);
  flush();
  return db;
}

export function log(type, payload) {
  const d = load();
  d.events.unshift({ id: id('ev'), type, payload, at: Date.now() });
  if (d.events.length > 500) d.events.length = 500;
  save();
}

let counter = 0;
export function id(prefix = 'x') {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(4, '0')}`;
}

process.on('exit', flush);
process.on('SIGINT', () => { flush(); process.exit(0); });
process.on('SIGTERM', () => { flush(); process.exit(0); });
