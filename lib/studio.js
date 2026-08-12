// Studio — the human surface. One canvas, every tool plugged in, work flows
// between them instead of between browser tabs.
//
// The join between the two halves of AI'sBook lives in runPipeline(): when a
// step errors or comes back ungrounded, Studio opens an Exchange query on the
// user's behalf instead of handing them a broken artifact.

import { load, save, id, log } from './store.js';
import { ensureTool, getTool } from './registry.js';
import { runStep, keyFor, connectionStatus, PROVIDER_ENV } from './adapters.js';
import { ask } from './exchange.js';

export const TEMPLATES = [
  {
    key: 'ai-video',
    name: 'AI video, end to end',
    goal: 'Take one idea to a finished, narrated, edited short.',
    blurb: 'The tab-juggling workflow this app exists to kill: ideation → script → voice → footage → cut.',
    steps: [
      { tool: 'claude', capability: 'ideate', prompt: 'Give me 5 angles for a 60-second video about: {{goal}}. Pick the strongest and say why.' },
      { tool: 'claude', capability: 'write', prompt: 'Write a 60-second script for the winning angle. Mark timing beats.', inputs: [0] },
      { tool: 'elevenlabs', capability: 'voice', prompt: 'Narrate this script.', inputs: [1] },
      { tool: 'veo', capability: 'video', prompt: 'Generate B-roll for each beat of this script.', inputs: [1] },
      { tool: 'suno', capability: 'music', prompt: 'Instrumental bed, understated, matches the script tone.', inputs: [1] },
      { tool: 'capcut', capability: 'edit', prompt: 'Assemble narration + B-roll + music. Burn in captions.', inputs: [2, 3, 4] },
    ],
  },
  {
    key: 'research-brief',
    name: 'Research → brief → deck',
    goal: 'Turn an open question into a sourced brief and a deck.',
    blurb: 'Search, synthesis, and slides without leaving the canvas.',
    steps: [
      { tool: 'perplexity', capability: 'research', prompt: 'Research: {{goal}}. Return claims with sources.' },
      { tool: 'claude', capability: 'write', prompt: 'Write a one-page brief. Every claim keeps its citation.', inputs: [0] },
      { tool: 'gamma', capability: 'slides', prompt: 'Turn the brief into a 8-slide deck.', inputs: [1] },
    ],
  },
  {
    key: 'podcast',
    name: 'Podcast → clips',
    goal: 'Cut a long recording into publishable shorts.',
    blurb: 'Transcribe, find the moments, cut, caption.',
    steps: [
      { tool: 'whisper', capability: 'transcribe', prompt: 'Transcribe the recording for: {{goal}}' },
      { tool: 'gemini', capability: 'reason', prompt: 'Find the 5 most clippable 30-60s moments. Give timecodes and a hook line each.', inputs: [0] },
      { tool: 'opus-clip', capability: 'edit', prompt: 'Cut those moments vertically with captions.', inputs: [1] },
    ],
  },
  {
    key: 'brand-shoot',
    name: 'Product shot → ad set',
    goal: 'One product photo into a full paid-social set.',
    blurb: 'Image gen, copy, and variants in one pass.',
    steps: [
      { tool: 'nano-banana', capability: 'image', prompt: 'Studio product shots for: {{goal}}. 4 angles, consistent lighting.' },
      { tool: 'claude', capability: 'write', prompt: 'Write 6 ad headlines + primary text variants.', inputs: [0] },
      { tool: 'adcreative', capability: 'design', prompt: 'Lay out the shots with the copy at 1:1, 4:5, 9:16.', inputs: [0, 1] },
    ],
  },
];

export function listTemplates() { return TEMPLATES; }

export function createPipeline({ name, goal, steps, owner = 'me', template = null }) {
  const db = load();
  const p = {
    id: id('p'),
    name: name || 'Untitled pipeline',
    goal: goal || '',
    owner,
    template,
    createdAt: Date.now(),
    steps: (steps || []).map((s, i) => {
      const tool = ensureTool(s.tool);
      return {
        id: `s${i}`,
        index: i,
        tool: tool.slug,
        toolName: tool.name,
        icon: tool.icon,
        provider: tool.provider,
        capability: s.capability || tool.capabilities[0],
        prompt: s.prompt || '',
        inputs: s.inputs || [],
        params: s.params || {},
      };
    }),
  };
  db.pipelines[p.id] = p;
  log('studio.create', { id: p.id, steps: p.steps.length });
  save();
  return p;
}

export function fromTemplate(key, goal, owner = 'me') {
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error(`no template ${key}`);
  return createPipeline({
    name: t.name,
    goal: goal || t.goal,
    owner,
    template: key,
    steps: t.steps.map((s) => ({ ...s, prompt: s.prompt.replace('{{goal}}', goal || t.goal) })),
  });
}

export function getPipeline(pid) { return load().pipelines[pid] || null; }
export function listPipelines(owner = 'me') {
  return Object.values(load().pipelines).filter((p) => p.owner === owner).sort((a, b) => b.createdAt - a.createdAt);
}

/** Execute every step in order, threading outputs along declared inputs. */
export async function runPipeline(pid, { owner = 'me', autoAsk = true } = {}) {
  const db = load();
  const p = db.pipelines[pid];
  if (!p) throw new Error('no such pipeline');

  const run = {
    id: id('r'),
    pipelineId: pid,
    owner,
    startedAt: Date.now(),
    status: 'running',
    steps: [],
    escalations: [],
  };
  db.runs[run.id] = run;
  save();

  const outputs = {};
  for (const step of p.steps) {
    const tool = getTool(step.tool);
    const upstream = (step.inputs || []).map((i) => outputs[typeof i === 'number' ? `s${i}` : i]).filter(Boolean);
    const t0 = Date.now();
    let res;
    try {
      res = await runStep({
        tool, capability: step.capability, prompt: step.prompt,
        upstream, params: step.params,
      });
    } catch (err) {
      res = { output: null, error: err.message, simulated: false, provider: tool.provider };
    }

    const rec = {
      stepId: step.id,
      tool: step.tool,
      toolName: step.toolName,
      icon: step.icon,
      capability: step.capability,
      provider: step.provider,
      status: res.error ? 'error' : 'ok',
      simulated: !!res.simulated,
      note: res.note || null,
      error: res.error || null,
      output: res.output,
      audio: res.audio || null,
      ms: Date.now() - t0,
    };

    // ── the bridge ────────────────────────────────────────────────────
    // A step that errored is exactly the moment a human would open six
    // tabs and start guessing. Instead, ask the network.
    if (res.error && autoAsk) {
      const ex = await ask({
        tool: step.tool,
        question: `${step.toolName} failed during a ${step.capability} step: "${res.error}". What is the actual fix?`,
        context: `Pipeline: ${p.name}\nStep prompt: ${step.prompt}\nUpstream outputs: ${upstream.length}`,
        asker: owner,
        askerModel: 'aicebook-studio',
        boundary: 'tool-error',
        capability: step.capability,
      });
      rec.escalation = {
        resolved: ex.resolved,
        queryId: ex.query?.id || null,
        canonId: ex.canon?.id || null,
        answer: ex.canon?.summary || ex.answers?.[0]?.body?.slice(0, 400) || null,
        answeredBy: ex.canon?.answeredBy || ex.answers?.[0]?.model || null,
        latencyMs: ex.latencyMs,
      };
      run.escalations.push(rec.escalation);
    }

    outputs[step.id] = res.output;
    run.steps.push(rec);
    save();
  }

  run.status = run.steps.some((s) => s.status === 'error') ? 'partial' : 'done';
  run.finishedAt = Date.now();
  run.ms = run.finishedAt - run.startedAt;
  run.liveSteps = run.steps.filter((s) => !s.simulated && s.status === 'ok').length;
  run.simulatedSteps = run.steps.filter((s) => s.simulated).length;
  log('studio.run', { id: run.id, status: run.status, ms: run.ms });
  save();
  return run;
}

export function getRun(rid) { return load().runs[rid] || null; }
export function listRuns(owner = 'me', limit = 20) {
  return Object.values(load().runs).filter((r) => r.owner === owner)
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
}

// ---- connections ------------------------------------------------------

/** Providers the user has plugged in. Keys live in env, never in the store. */
export function connections(owner = 'me') {
  const db = load();
  const mine = db.connections[owner] || {};
  const providers = new Set([...Object.keys(PROVIDER_ENV), ...Object.keys(mine)]);
  return [...providers].map((p) => ({
    ...connectionStatus(p),
    plugged: !!mine[p]?.plugged || !!keyFor(p),
    addedAt: mine[p]?.addedAt || null,
  })).sort((a, b) => Number(b.live) - Number(a.live) || a.provider.localeCompare(b.provider));
}

export function connectedProviders(owner = 'me') {
  return connections(owner).filter((c) => c.plugged).map((c) => c.provider);
}

/** Marks a provider as plugged in. Does NOT accept a raw key — by design. */
export function plug(owner, provider, plugged = true) {
  const db = load();
  db.connections[owner] ??= {};
  db.connections[owner][provider] = { plugged, addedAt: Date.now() };
  log('studio.plug', { owner, provider, plugged });
  save();
  return connections(owner);
}
