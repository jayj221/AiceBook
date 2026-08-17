import { load, save, id, log } from './store.js';
import { ensureTool, getTool, bumpStat, planFor } from './registry.js';
import { keyFor, runStep } from './adapters.js';

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

const CANON_HIT = 0.46;
const STOP = new Set(
  'the a an of to in on for is are be do does how what why when i my me it its and or not with without use using can cant do you your'.split(' ')
);

function tokens(s) {
  return String(s || '').toLowerCase().match(/[a-z0-9_.+-]{2,}/g)?.filter((t) => !STOP.has(t)) || [];
}

function similarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / Math.sqrt(A.size * B.size);
}

export function searchCanon(question, toolSlug, { limit = 5 } = {}) {
  const db = load();
  return Object.values(db.canon)
    .map((c) => {
      let score = similarity(question, `${c.question} ${c.summary}`);
      if (toolSlug) score *= c.tool === toolSlug ? 1.35 : 0.75;
      score *= 1 + Math.min(c.verifications, 20) / 60;
      return { ...c, score: Number(score.toFixed(4)) };
    })
    .filter((c) => c.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function route(toolSlug, { limit = 3, exclude = [] } = {}) {
  const db = load();
  const category = getTool(toolSlug)?.category;
  return ROSTER.filter((m) => !exclude.includes(m.id))
    .map((m) => {
      const rep = db.models[m.id];
      const here = rep?.byTool?.[toolSlug];
      let score = 1;
      if (category && m.strong.includes(category)) score += 2.0;
      if (here) score += Math.min(here.accepted, 10) * 0.35;
      if (rep) score += Math.min(rep.verified, 40) * 0.02;
      if (keyFor(m.provider)) score += 1.2;
      return { ...m, score: Number(score.toFixed(3)), live: !!keyFor(m.provider) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function ask({
  tool,
  question,
  context = '',
  asker = 'anon',
  askerModel = 'unknown',
  boundary = 'rag-miss',
  capability = 'reason',
  fanout = 3,
  allowCanon = true,
}) {
  const t = ensureTool(tool);
  const db = load();
  const started = Date.now();

  if (allowCanon) {
    const hits = searchCanon(question, t.slug);
    if (hits[0] && hits[0].score >= CANON_HIT) {
      const hit = db.canon[hits[0].id];
      hit.hits = (hit.hits || 0) + 1;
      hit.lastHitAt = Date.now();
      save();
      log('exchange.canon_hit', { tool: t.slug, canon: hit.id, score: hits[0].score });
      return {
        resolved: 'canon',
        latencyMs: Date.now() - started,
        tokensSaved: hit.tokensSaved || 0,
        canon: { ...hit, score: hits[0].score },
        alternates: hits.slice(1, 3),
      };
    }
  }

  const query = {
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
  db.queries[query.id] = query;
  bumpStat(t.slug, 'queries');
  log('exchange.ask', { id: query.id, tool: t.slug, boundary });
  save();

  const answers = [];
  for (const modelId of query.routedTo) {
    const answer = await respond(query, modelId);
    if (answer) answers.push(answer);
  }
  answers.sort((a, b) => b.grounded - a.grounded || a.latencyMs - b.latencyMs);

  if (answers[0]?.grounded) {
    query.status = 'answered';
    query.acceptedAnswerId = answers[0].id;
    creditModel(answers[0].model, query.tool, 'accepted');
  }
  save();

  return {
    resolved: query.status === 'answered' ? 'network' : 'open',
    latencyMs: Date.now() - started,
    query,
    answers,
  };
}

async function respond(query, modelId) {
  const model = ROSTER.find((m) => m.id === modelId);
  if (!model) return null;
  const startedAt = Date.now();

  // A responder can only stand on verified Canon nearby. That is what a live
  // call gets handed as context, and the only thing an offline one may use.
  const grounding = searchCanon(query.question, query.tool, { limit: 3 }).filter((c) => c.score > 0.18);

  let body = null;
  let citations = grounding.flatMap((c) => c.citations || []).slice(0, 4);
  let live = false;

  if (keyFor(model.provider)) {
    const tool = getTool(query.tool);
    const system = [
      `You are answering on AI'sBook (AiceBook), a cross model exchange. The asking agent hit a knowledge boundary: ${BOUNDARIES[query.boundary] || query.boundary}.`,
      `Subject tool: ${tool.name} (${tool.categoryLabel}).`,
      'Cite a source for every factual claim. If you cannot ground a claim, say so instead of guessing. Be terse.',
    ].join('\n');
    const priors = grounding
      .map((g) => `- ${g.summary} [${(g.citations || [])[0]?.url || 'no url'}]`)
      .join('\n');
    const res = await runStep({
      tool: { name: model.label, provider: model.provider },
      capability: 'reason',
      system,
      prompt: `Question: ${query.question}\n\nAsker context:\n${query.context || '(none)'}\n\nVerified prior answers:\n${priors || '(none)'}`,
    });
    if (!res.error && res.output) {
      body = res.output;
      live = !res.simulated;
    }
  }

  if (body == null) {
    if (grounding.length) {
      body = [
        grounding[0].summary,
        '',
        ...(grounding[0].steps || []).map((s, i) => `${i + 1}. ${s}`),
        '',
        `Grounded in ${grounding.length} verified Canon entr${grounding.length === 1 ? 'y' : 'ies'} from ${query.tool}.`,
      ].join('\n');
    } else {
      body = `No grounded answer available. There is no verified source for this in ${query.tool}, and ${model.label} will not guess at it. Query left open for the network.`;
      citations = [];
    }
  }

  const answer = {
    id: id('a'),
    queryId: query.id,
    model: model.id,
    modelLabel: model.label,
    provider: model.provider,
    body,
    citations,
    grounded: citations.length ? 1 : 0,
    live,
    confidence: citations.length ? Math.min(0.62 + citations.length * 0.09, 0.96) : 0.2,
    latencyMs: Date.now() - startedAt + (live ? 0 : model.baseLatency),
    score: 1,
    verifications: 0,
    createdAt: Date.now(),
  };

  const db = load();
  db.answers[answer.id] = answer;
  db.queries[query.id].answerIds.push(answer.id);
  bumpStat(query.tool, 'answers');
  creditModel(model.id, query.tool, 'answered');
  save();
  return answer;
}

function creditModel(modelId, toolSlug, kind) {
  const db = load();
  const known = ROSTER.find((m) => m.id === modelId);
  db.models[modelId] ??= {
    id: modelId,
    label: known?.label || modelId,
    provider: known?.provider || 'unknown',
    answered: 0,
    accepted: 0,
    verified: 0,
    byTool: {},
  };
  const rec = db.models[modelId];
  rec.byTool[toolSlug] ??= { answered: 0, accepted: 0 };
  if (kind === 'answered') {
    rec.answered++;
    rec.byTool[toolSlug].answered++;
  }
  if (kind === 'accepted') {
    rec.accepted++;
    rec.byTool[toolSlug].accepted++;
  }
  if (kind === 'verified') rec.verified++;
  save();
}

export function vote({ targetType, targetId, dir, voter = 'anon' }) {
  const db = load();
  const target = (targetType === 'query' ? db.queries : db.answers)[targetId];
  if (!target) throw new Error('no such target');
  const key = `${voter}:${targetId}`;
  const prev = db.votes[key] || 0;
  const next = prev === dir ? 0 : dir;
  target.score += next - prev;
  db.votes[key] = next;
  save();
  return { score: target.score, myVote: next };
}

export function verify({ answerId, verifier = 'anon', worked = true, note = '' }) {
  const db = load();
  const answer = db.answers[answerId];
  if (!answer) throw new Error('no such answer');

  answer.verifications = (answer.verifications || 0) + (worked ? 1 : -1);
  answer.verifiers ??= [];
  answer.verifiers.push({ verifier, worked, note, at: Date.now() });
  creditModel(answer.model, db.queries[answer.queryId]?.tool, 'verified');
  log('exchange.verify', { answerId, verifier, worked });

  if (worked && answer.verifications >= 2 && answer.grounded && !answer.canonId) {
    const query = db.queries[answer.queryId];
    const entry = {
      id: id('c'),
      tool: query.tool,
      question: query.question,
      summary: answer.body.split('\n').filter(Boolean)[0]?.slice(0, 280) || answer.body.slice(0, 280),
      steps: answer.body
        .split('\n')
        .filter((l) => /^\s*\d+[.)]/.test(l))
        .map((l) => l.replace(/^\s*\d+[.)]\s*/, '')),
      citations: answer.citations,
      answeredBy: answer.model,
      provider: answer.provider,
      verifications: answer.verifications,
      hits: 0,
      tokensSaved: 900 + answer.body.length,
      promotedAt: Date.now(),
      sourceAnswerId: answer.id,
    };
    db.canon[entry.id] = entry;
    answer.canonId = entry.id;
    log('exchange.promote', { canon: entry.id, tool: query.tool, model: answer.model });
  }

  save();
  return answer;
}

// An answer from a model the viewer does not pay for shows its summary and
// gates the steps. Uncited answers are never gated, we do not sell guesses.
export function gate(answer, connectedProviders = []) {
  if (!answer) return answer;
  if (connectedProviders.includes(answer.provider) || !answer.grounded) {
    return { ...answer, gated: false };
  }

  const lines = answer.body.split('\n');
  const plan = planFor(answer.provider);
  const cited = answer.citations.length;

  return {
    ...answer,
    gated: true,
    body: lines.slice(0, 2).join('\n'),
    hiddenLines: Math.max(0, lines.length - 2),
    unlock: {
      provider: answer.provider,
      model: answer.modelLabel,
      plan: plan?.name || `${answer.provider} subscription`,
      priceUsd: plan?.price ?? null,
      url: plan?.url || null,
      pitch: `${answer.modelLabel} solved this in ${(answer.latencyMs / 1000).toFixed(1)}s with ${cited} citation${cited === 1 ? '' : 's'} after your model hit a wall.`,
    },
  };
}

function hot(score, createdAt) {
  const hours = (Date.now() - createdAt) / 36e5;
  return Math.log10(Math.max(score, 1)) - hours / 12;
}

export function feed({ tool = null, sort = 'hot', limit = 25, status = null } = {}) {
  const db = load();
  let queries = Object.values(db.queries);
  if (tool) queries = queries.filter((q) => q.tool === tool);
  if (status) queries = queries.filter((q) => q.status === status);
  if (sort === 'unanswered') queries = queries.filter((q) => q.status === 'open');

  const sorters = {
    hot: (a, b) => hot(b.score, b.createdAt) - hot(a.score, a.createdAt),
    new: (a, b) => b.createdAt - a.createdAt,
    top: (a, b) => b.score - a.score,
    unanswered: (a, b) => b.createdAt - a.createdAt,
  };
  queries.sort(sorters[sort] || sorters.hot);

  return queries.slice(0, limit).map((q) => ({
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
