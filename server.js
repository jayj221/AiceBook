// AI'sBook, zero-dependency server. `node server.js` and it runs.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { load, flush } from './lib/store.js';
import * as registry from './lib/registry.js';
import * as exchange from './lib/exchange.js';
import * as studio from './lib/studio.js';
import { seed } from './data/seed.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PORT = Number(process.env.PORT || 4173);

registry.boot();
seed();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

function json(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(s),
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(s);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('invalid JSON body'); }
}

const routes = [];
const on = (method, pattern, handler) => routes.push({ method, pattern, handler });

// registry
on('GET', /^\/api\/tools$/, (req, res, _m, url) => {
  const q = url.searchParams.get('q') || '';
  const limit = Math.min(Number(url.searchParams.get('limit') || 40), 200);
  json(res, 200, {
    total: registry.allTools().length,
    results: registry.searchTools(q, {
      limit,
      category: url.searchParams.get('category'),
      capability: url.searchParams.get('capability'),
    }),
  });
});

on('GET', /^\/api\/categories$/, (_req, res) => json(res, 200, registry.categories()));

on('GET', /^\/api\/tools\/([\w.-]+)$/, (_req, res, m) => {
  const t = registry.getTool(m[1]);
  if (!t) return json(res, 404, { error: 'unknown tool' });
  json(res, 200, {
    ...t,
    canon: Object.values(load().canon).filter((c) => c.tool === t.slug),
    feed: exchange.feed({ tool: t.slug, limit: 20 }),
  });
});

on('POST', /^\/api\/tools$/, async (req, res) => {
  const b = await readBody(req);
  if (!b.name) return json(res, 400, { error: 'name required' });
  json(res, 201, registry.ensureTool(b.name, b));
});

// exchange
on('GET', /^\/api\/feed$/, (_req, res, _m, url) => {
  const owned = studio.connectedProviders(url.searchParams.get('as') || 'me');
  const items = exchange.feed({
    tool: url.searchParams.get('tool'),
    sort: url.searchParams.get('sort') || 'hot',
    limit: Math.min(Number(url.searchParams.get('limit') || 25), 100),
  });
  // The gate applies everywhere an answer is rendered, not just on ask.
  json(res, 200, items.map((q) => ({ ...q, answers: q.answers.map((a) => exchange.gate(a, owned)) })));
});

// Communities = tools that actually have Exchange activity, counted honestly.
on('GET', /^\/api\/communities$/, (_req, res) => {
  const db = load();
  const counts = {};
  for (const q of Object.values(db.queries)) {
    counts[q.tool] ??= { slug: q.tool, queries: 0, open: 0, canon: 0 };
    counts[q.tool].queries++;
    if (q.status === 'open') counts[q.tool].open++;
  }
  for (const c of Object.values(db.canon)) {
    counts[c.tool] ??= { slug: c.tool, queries: 0, open: 0, canon: 0 };
    counts[c.tool].canon++;
  }
  json(res, 200, Object.values(counts)
    .map((c) => ({ ...c, ...registry.getTool(c.slug) }))
    .sort((a, b) => b.queries - a.queries || b.canon - a.canon));
});

on('POST', /^\/api\/ask$/, async (req, res) => {
  const b = await readBody(req);
  if (!b.tool || !b.question) return json(res, 400, { error: 'tool and question required' });
  const result = await exchange.ask(b);
  const owned = studio.connectedProviders(b.asker || 'me');
  if (result.answers) result.answers = result.answers.map((a) => exchange.gate(a, owned));
  json(res, 200, result);
});

on('GET', /^\/api\/queries\/([\w]+)$/, (_req, res, m, url) => {
  const db = load();
  const q = db.queries[m[1]];
  if (!q) return json(res, 404, { error: 'unknown query' });
  const owner = url.searchParams.get('as') || 'me';
  const owned = studio.connectedProviders(owner);
  json(res, 200, { ...q, answers: q.answerIds.map((a) => exchange.gate(db.answers[a], owned)).filter(Boolean) });
});

on('POST', /^\/api\/vote$/, async (req, res) => {
  const b = await readBody(req);
  try { json(res, 200, exchange.vote(b)); }
  catch (e) { json(res, 400, { error: e.message }); }
});

on('POST', /^\/api\/verify$/, async (req, res) => {
  const b = await readBody(req);
  try { json(res, 200, exchange.verify(b)); }
  catch (e) { json(res, 400, { error: e.message }); }
});

on('GET', /^\/api\/canon$/, (_req, res, _m, url) => {
  const q = url.searchParams.get('q');
  json(res, 200, q
    ? exchange.searchCanon(q, url.searchParams.get('tool'), { limit: 10 })
    : Object.values(load().canon).sort((a, b) => b.hits - a.hits).slice(0, 50));
});

on('GET', /^\/api\/models$/, (_req, res) => json(res, 200, {
  roster: exchange.ROSTER, leaderboard: exchange.leaderboard(),
}));

on('GET', /^\/api\/route$/, (_req, res, _m, url) =>
  json(res, 200, exchange.route(url.searchParams.get('tool') || 'claude', { limit: 5 })));

on('GET', /^\/api\/stats$/, (_req, res) => json(res, 200, {
  ...exchange.stats(),
  boundaries: exchange.BOUNDARIES,
  events: load().events.slice(0, 20),
}));

// studio
on('GET', /^\/api\/templates$/, (_req, res) => json(res, 200, studio.listTemplates()));

on('GET', /^\/api\/pipelines$/, (_req, res, _m, url) =>
  json(res, 200, studio.listPipelines(url.searchParams.get('as') || 'me')));

on('POST', /^\/api\/pipelines$/, async (req, res) => {
  const b = await readBody(req);
  try {
    json(res, 201, b.template ? studio.fromTemplate(b.template, b.goal, b.owner) : studio.createPipeline(b));
  } catch (e) { json(res, 400, { error: e.message }); }
});

on('GET', /^\/api\/pipelines\/([\w]+)$/, (_req, res, m) => {
  const p = studio.getPipeline(m[1]);
  return p ? json(res, 200, p) : json(res, 404, { error: 'unknown pipeline' });
});

on('POST', /^\/api\/pipelines\/([\w]+)\/run$/, async (req, res, m) => {
  try { json(res, 200, await studio.runPipeline(m[1], await readBody(req))); }
  catch (e) { json(res, 400, { error: e.message }); }
});

on('GET', /^\/api\/runs$/, (_req, res, _m, url) =>
  json(res, 200, studio.listRuns(url.searchParams.get('as') || 'me')));

on('GET', /^\/api\/runs\/([\w]+)$/, (_req, res, m) => {
  const r = studio.getRun(m[1]);
  return r ? json(res, 200, r) : json(res, 404, { error: 'unknown run' });
});

on('GET', /^\/api\/connections$/, (_req, res, _m, url) =>
  json(res, 200, studio.connections(url.searchParams.get('as') || 'me')));

on('POST', /^\/api\/connections$/, async (req, res) => {
  const b = await readBody(req);
  if (!b.provider) return json(res, 400, { error: 'provider required' });
  json(res, 200, studio.plug(b.owner || 'me', b.provider, b.plugged !== false));
});

on('GET', /^\/api\/health$/, (_req, res) => json(res, 200, { ok: true, uptime: process.uptime() }));

// static
async function serveStatic(pathname, res) {
  const rel = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return json(res, 403, { error: 'forbidden' });
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error('not a file');
    const buf = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  } catch {
    // SPA fallback
    try {
      const buf = await readFile(join(PUBLIC, 'index.html'));
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(buf);
    } catch { json(res, 404, { error: 'not found' }); }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.pattern);
    if (!m) continue;
    try { return await r.handler(req, res, m, url); }
    catch (err) {
      console.error('[api]', url.pathname, err);
      return json(res, 500, { error: err.message });
    }
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'no such endpoint' });
  return serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
  const s = exchange.stats();
  console.log(`\n  AI'sBook  →  http://localhost:${PORT}`);
  console.log(`  registry: ${s.tools} tools · canon: ${s.canon} entries · queries: ${s.queries}`);
  const live = studio.connections().filter((c) => c.live).map((c) => c.provider);
  console.log(`  live providers: ${live.length ? live.join(', ') : 'none (set API keys to run steps for real)'}\n`);
});

process.on('SIGINT', () => { flush(); server.close(() => process.exit(0)); });
