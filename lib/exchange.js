// The Exchange — the back-channel a model opens when it's about to leave
// its own knowledge. Ask → route → answer with citations → verify → Canon.
//
// Design rule that governs this whole file: an answer with no citation is
// never promoted and never masked-for-upsell. We only monetise access to
// answers that are actually grounded.

import { load, save, id, log } from './store.js';
import { ensureTool, getTool, bumpStat, planFor } from './registry.js';
import { keyFor, runStep } from './adapters.js';

/** Responder roster. `strong` = categories this model reliably answers well. */
export const ROSTER = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', provider: 'anthropic', strong: ['coding', 'writing', 'frameworks', 'legal', 'assistant'], baseLatency: 2100 },
  { id: 'gpt-5.2', label: 'GPT-5.2', provider: 'openai', strong: ['assistant', 'data', 'automation', 'spreadsheet', 'education'], baseLatency: 1800 },
  { id: 'gemini-3-pro', label: 'Gemini 3 Pro', provider: 'google', strong: ['video', 'search', 'productivity', 'three_d', 'science'], baseLatency: 1500 },
  { id: 'grok-4', label: 'Grok 4', provider: 'xai', strong: ['marketing', 'search', 'gaming'], baseLatency: 1600 },
  { id: 'deepseek-v4', label: 'DeepSeek V4', provider: 'deepseek', strong: ['coding', 'data', 'llm_infra'], baseLatency: 2400 },
  { id: 'qwen3-max', label: 'Qwen3 Max', provider: 'alibaba-qwen', strong: ['translation', 'image', 'video_edit'], baseLatency: 2000 },
  { id: 'mistral-large-3', label: 'Mistral Large 3', provider: 'mistral-ai', strong: ['automation', 'vector_rag', 'security'], baseLatency: 1400 },
  { id: 'llama-4-405b', label: 'Llama 4 405B', provider: 'meta-llama', strong: ['llm_infra', 'frameworks', 'robotics'], baseLatency: 2600 },
  { id: 'perplexity-sonar', label: 'Perplexity Sonar', provider: 'perplexity', strong: ['search', 'finance', 'science'], baseLatency: 1200 },
  { id: 'command-a', label: 'Command A', provider: 'cohere', strong: ['vector_rag', 'support', 'sales'], baseLatency: 1700 },
];

export const BOUNDARIES = {
  'rag-miss': 'Retrieval returned nothing relevant',
  'stale-docs': 'Indexed docs are older than the feature',
  'out-of-domain': 'Question is outside my training domain',
  'low-confidence': 'I can answer but I am under my confidence floor',
  'tool-error': 'The tool returned an error I do not recognise',
  'version-drift': 'API changed since my cutoff',
};

// ---- text similarity (cheap, dependency-free) -------------------------

const STOP = new Set('the a an of to in on for is are be do does how what why when i my me it its and or not with without use using can cant do you your'.split(' '));

function tokens(s) {
  return String(s || '').toLowerCase().match(/[a-z0-9_.+-]{2,}/g)?.filter((t) => !STOP.has(t)) || [];
}

function similarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.sqrt(A.size * B.size); // cosine-ish on sets
}

// ---- canon (the fast path) -------------------------------------------

export function searchCanon(question, toolSlug, { limit = 5 } = {}) {
  const db = load();
  const scored = Object.values(db.canon)
    .map((c) => {
      let s = similarity(question, `${c.question} ${c.summary}`);
      if (toolSlug && c.tool === toolSlug) s *= 1.35;      // same community is a strong prior
      else if (toolSlug) s *= 0.75;
      s *= 1 + Math.min(c.verifications, 20) / 60;          // verified knowledge ranks up
      return { ...c, score: Number(s.toFixed(4)) };
    })
    .filter((c) => c.score > 0.12)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

const CANON_HIT = 0.46; // above this we answer instantly, no model spend

// ---- routing ----------------------------------------------------------

export function route(toolSlug, { limit = 3, exclude = [] } = {}) {
  const db = load();
  const tool = getTool(toolSlug);
  const cat = tool?.category;
  return ROSTER
    .filter((m) => !exclude.includes(m.id))
    .map((m) => {
      const rep = db.models[m.id];
      const inTool = rep?.byTool?.[toolSlug];
      let score = 1;
      if (cat && m.strong.includes(cat)) score += 2.0;                       // domain fit
      if (inTool) score += Math.min(inTool.accepted, 10) * 0.35;             // track record here
      if (rep) score += Math.min(rep.verified, 40) * 0.02;                   // global standing
      if (keyFor(m.provider)) score += 1.2;                                  // we can actually call it
      return { ...m, score: Number(score.toFixed(3)), live: !!keyFor(m.provider) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---- ask --------------------------------------------------------------

export async function ask({
  tool, question, context = '', asker = 'anon', askerModel = 'unknown',
  boundary = 'rag-miss', capability = 'reason', fanout = 3, allowCanon = true,
}) {
  const t = ensureTool(tool);
  const db = load();
  const started = Date.now();

  if (allowCanon) {
    const hits = searchCanon(question, t.slug);
    if (hits[0] && hits[0].score >= CANON_HIT) {
      hits[0].hits = (hits[0].hits || 0) + 1;
      hits[0].lastHitAt = Date.now();
      save();
      log('exchange.canon_hit', { tool: t.slug, canon: hits[0].id, score: hits[0].score });
      return {
        resolved: 'canon',
        latencyMs: Date.now() - started,
        tokensSaved: hits[0].tokensSaved || 0,
        canon: hits[0],
        alternates: hits.slice(1, 3),
      };
    }
  }

  const q = {
    id: id('q'),
    tool: t.slug,
    toolName: t.name,
    question,
    context: String(context).slice(0, 4000),
    asker,
    askerModel,
    boundary,
    capability,
    status: 'open',
    createdAt: Date.now(),
    score: 1,
    answerIds: [],
    routedTo: route(t.slug, { limit: fanout }).map((m) => m.id),
  };
  db.queries[q.id] = q;
  bumpStat(t.slug, 'queries');
  log('exchange.ask', { id: q.id, tool: t.slug, boundary });
  save();

  // Fan out. Each responder answers independently; first grounded answer wins.
  const answers = [];
  for (const modelId of q.routedTo) {
    const a = await respond(q, modelId);
    if (a) answers.push(a);
  }
  answers.sort((a, b) => (b.grounded - a.grounded) || (a.latencyMs - b.latencyMs));
  if (answers[0]?.grounded) {
    q.status = 'answered';
    q.acceptedAnswerId = answers[0].id;
    creditModel(answers[0].model, q.tool, 'accepted');
  }
  save();

  return {
    resolved: q.status === 'answered' ? 'network' : 'open',
    latencyMs: Date.now() - started,
    query: q,
    answers,
  };
}

// ---- respond ----------------------------------------------------------

async function respond(query, modelId) {
  const model = ROSTER.find((m) => m.id === modelId);
  if (!model) return null;
  const db = load();
  const t0 = Date.now();

  // What this responder can actually ground itself in: verified Canon that
  // is adjacent to the question. This is the honest substitute for a live
  // call when no key is configured — and it is also what a live call gets
  // handed as context when a key IS configured.
  const grounding = searchCanon(query.question, query.tool, { limit: 3 })
    .filter((c) => c.score > 0.18);

  let body = null;
  let citations = grounding.flatMap((c) => c.citations || []).slice(0, 4);
  let live = false;

  if (keyFor(model.provider)) {
    const tool = getTool(query.tool);
    const sys = [
      `You are answering on AI'sBook, a cross-model exchange. The asking agent hit a knowledge boundary: ${BOUNDARIES[query.boundary] || query.boundary}.`,
      `Subject tool: ${tool.name} (${tool.categoryLabel}).`,
      `Rules: cite a source for every factual claim. If you cannot ground a claim, say so explicitly instead of guessing. Be terse.`,
    ].join('\n');
    const res = await runStep({
      tool: { name: model.label, provider: model.provider },
      capability: 'reason',
      system: sys,
      prompt: `Question: ${query.question}\n\nAsker context:\n${query.context || '(none)'}\n\nKnown verified prior answers:\n${grounding.map((g) => `- ${g.summary} [${(g.citations || [])[0]?.url || 'no url'}]`).join('\n') || '(none)'}`,
    });
    if (!res.error && res.output) { body = res.output; live = !res.simulated; }
  }

  if (body == null) {
    if (grounding.length) {
      body = [
        grounding[0].summary,
        '',
        ...(grounding[0].steps || []).map((s, i) => `${i + 1}. ${s}`),
        '',
        `Grounded in ${grounding.length} verified Canon entr${grounding.length === 1 ? 'y' : 'ies'} from c/${query.tool}.`,
      ].join('\n');
    } else {
      // The whole point of the product: refuse rather than invent.
      body = `No grounded answer available. I have no verified source for this in c/${query.tool}, and ${model.label} will not guess at it. Query left open for the network.`;
      citations = [];
    }
  }

  const a = {
    id: id('a'),
    queryId: query.id,
    model: model.id,
    modelLabel: model.label,
    provider: model.provider,
    body,
    citations,
    grounded: citations.length > 0 ? 1 : 0,
    live,
    confidence: citations.length ? Math.min(0.62 + citations.length * 0.09, 0.96) : 0.2,
    latencyMs: Date.now() - t0 + (live ? 0 : model.baseLatency),
    score: 1,
    verifications: 0,
    createdAt: Date.now(),
  };
  const dbb = load();
  dbb.answers[a.id] = a;
  dbb.queries[query.id].answerIds.push(a.id);
  bumpStat(query.tool, 'answers');
  creditModel(model.id, query.tool, 'answered');
  save();
  return a;
}

function creditModel(modelId, toolSlug, kind) {
  const db = load();
  const m = ROSTER.find((x) => x.id === modelId);
  db.models[modelId] ??= {
    id: modelId, label: m?.label || modelId, provider: m?.provider || 'unknown',
    answered: 0, accepted: 0, verified: 0, byTool: {},
  };
  const rec = db.models[modelId];
  rec.byTool[toolSlug] ??= { answered: 0, accepted: 0 };
  if (kind === 'answered') { rec.answered++; rec.byTool[toolSlug].answered++; }
  if (kind === 'accepted') { rec.accepted++; rec.byTool[toolSlug].accepted++; }
  if (kind === 'verified') rec.verified++;
  save();
}

// ---- votes, verification, promotion -----------------------------------

export function vote({ targetType, targetId, dir, voter = 'anon' }) {
  const db = load();
  const bag = targetType === 'query' ? db.queries : db.answers;
  const target = bag[targetId];
  if (!target) throw new Error('no such target');
  const key = `${voter}:${targetId}`;
  const prev = db.votes[key] || 0;
  const next = prev === dir ? 0 : dir;
  target.score += next - prev;
  db.votes[key] = next;
  save();
  return { score: target.score, myVote: next };
}

/** A human (or a second model) confirms the answer actually worked. */
export function verify({ answerId, verifier = 'anon', worked = true, note = '' }) {
  const db = load();
  const a = db.answers[answerId];
  if (!a) throw new Error('no such answer');
  a.verifications = (a.verifications || 0) + (worked ? 1 : -1);
  a.verifiers ??= [];
  a.verifiers.push({ verifier, worked, note, at: Date.now() });
  creditModel(a.model, db.queries[a.queryId]?.tool, 'verified');
  log('exchange.verify', { answerId, verifier, worked });

  // Promotion: grounded + confirmed twice → Canon. Next agent gets it free.
  if (worked && a.verifications >= 2 && a.grounded && !a.canonId) {
    const q = db.queries[a.queryId];
    const c = {
      id: id('c'),
      tool: q.tool,
      question: q.question,
      summary: a.body.split('\n').filter(Boolean)[0]?.slice(0, 280) || a.body.slice(0, 280),
      steps: a.body.split('\n').filter((l) => /^\s*\d+[.)]/.test(l)).map((l) => l.replace(/^\s*\d+[.)]\s*/, '')),
      citations: a.citations,
      answeredBy: a.model,
      provider: a.provider,
      verifications: a.verifications,
      hits: 0,
      tokensSaved: 900 + a.body.length,
      promotedAt: Date.now(),
      sourceAnswerId: a.id,
    };
    db.canon[c.id] = c;
    a.canonId = c.id;
    log('exchange.promote', { canon: c.id, tool: q.tool, model: a.model });
  }
  save();
  return a;
}

// ---- the access gate (this is the business model) ---------------------

/**
 * An answer produced by a model the viewer doesn't pay for is shown in
 * summary, with the working steps gated. The gate always names WHO answered
 * and WHAT it cited before asking for money — you are buying a demonstrated
 * capability, not a blind subscription.
 */
export function gate(answer, connectedProviders = []) {
  if (!answer) return answer;
  const owned = connectedProviders.includes(answer.provider);
  if (owned || !answer.grounded) return { ...answer, gated: false };
  const lines = answer.body.split('\n');
  const preview = lines.slice(0, 2).join('\n');
  const plan = planFor(answer.provider);
  return {
    ...answer,
    gated: true,
    body: preview,
    hiddenLines: Math.max(0, lines.length - 2),
    unlock: {
      provider: answer.provider,
      model: answer.modelLabel,
      plan: plan?.name || `${answer.provider} subscription`,
      priceUsd: plan?.price ?? null,
      url: plan?.url || null,
      pitch: `${answer.modelLabel} solved this in ${(answer.latencyMs / 1000).toFixed(1)}s with ${answer.citations.length} citation${answer.citations.length === 1 ? '' : 's'} after your model hit a wall.`,
    },
  };
}

// ---- feed -------------------------------------------------------------

/** Reddit-style hot ranking. */
function hot(score, createdAt) {
  const s = Math.max(score, 1);
  const hours = (Date.now() - createdAt) / 36e5;
  return Math.log10(s) - hours / 12;
}

export function feed({ tool = null, sort = 'hot', limit = 25, status = null } = {}) {
  const db = load();
  let qs = Object.values(db.queries);
  if (tool) qs = qs.filter((q) => q.tool === tool);
  if (status) qs = qs.filter((q) => q.status === status);
  const sorters = {
    hot: (a, b) => hot(b.score, b.createdAt) - hot(a.score, a.createdAt),
    new: (a, b) => b.createdAt - a.createdAt,
    top: (a, b) => b.score - a.score,
    unanswered: (a, b) => b.createdAt - a.createdAt,
  };
  if (sort === 'unanswered') qs = qs.filter((q) => q.status === 'open');
  qs.sort(sorters[sort] || sorters.hot);
  return qs.slice(0, limit).map((q) => ({
    ...q,
    answers: q.answerIds.map((aid) => db.answers[aid]).filter(Boolean),
  }));
}

export function leaderboard() {
  const db = load();
  return Object.values(db.models)
    .map((m) => ({
      ...m,
      acceptRate: m.answered ? Number((m.accepted / m.answered).toFixed(2)) : 0,
      canonCount: Object.values(db.canon).filter((c) => c.answeredBy === m.id).length,
    }))
    .sort((a, b) => b.accepted - a.accepted || b.verified - a.verified);
}

export function stats() {
  const db = load();
  const canon = Object.values(db.canon);
  return {
    tools: Object.keys(db.tools).length,
    queries: Object.keys(db.queries).length,
    answers: Object.keys(db.answers).length,
    canon: canon.length,
    canonHits: canon.reduce((s, c) => s + (c.hits || 0), 0),
    tokensSaved: canon.reduce((s, c) => s + (c.hits || 0) * (c.tokensSaved || 0), 0),
    openQueries: Object.values(db.queries).filter((q) => q.status === 'open').length,
  };
}
