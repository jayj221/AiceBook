import { MODELS, PRICES_CHECKED, byId } from '../data/models.js';

const RX = {
  voice: /\b(narrat|voice ?over|voiceover|tts|text to speech|speak|say this|dub|audiobook|podcast voice)\w*/i,
  video: /\b(video|b-?roll|footage|clip|animate|animation|scene|cinematic|reel)\w*/i,
  image: /\b(image|photo|picture|illustration|thumbnail|logo|render|artwork|poster|mockup)\w*/i,
  music: /\b(music|song|soundtrack|beat|instrumental|score|jingle|theme tune)\w*/i,
  transcribe: /\b(transcri|caption|subtitle|srt|diariz)\w*/i,
  search: /\b(latest|current|recent|today|this week|news|up to date|who won|stock price|cite sources|look up)\w*/i,
  code: /\b(functions?|class(es)?|methods?|bugs?|stack ?traces?|apis?|endpoints?|typescript|javascript|python|rust|golang|sql|regexp?|compiles?|unit tests?|deploys?|docker|kubernetes|schemas?)\b/i,
  repo: /\b(codebase|repository|repo|monorepo|across files|whole project|entire project|all the files|migration)\w*/i,
  app: /\b(landing page|web app|build me a site|dashboard|prototype|crud|full stack)\w*/i,
  docs: /\b(my notes|our wiki|knowledge base|workspace|meeting notes|internal docs)\w*/i,
};

const DEEP = /\b(architect|design a system|prove|derive|root cause|trade-?off|refactor|migrate|optimi[sz]|security review|algorithm|race condition|distributed|why does|edge case|deep(ly)? analy|reason through|step by step|critique|strategy|forecast|model the)\w*/i;
const SHALLOW = /\b(summari[sz]|tl;?dr|rewrite|rephrase|translate|extract|classif|categori[sz]|tag|label|format|proofread|spellcheck|shorten|subject line|title for|bullet points|clean up)\w*/i;
const STAKES = /\b(production|customer facing|legal|contract|compliance|medical|clinical|diagnos|financial statement|audit|security|regulat|patient|liabilit)\w*/i;
const VOLUME = /\b(every|all of|bulk|batch|thousands|millions|\d{3,}\s*(rows|records|documents|tickets|emails|items)|at scale|per day|nightly)\w*/i;
const LONG_OUT = /\b(essay|report|whitepaper|long form|detailed write-?up|full draft|chapter|\d{3,}\s*words)\w*/i;
const SHORT_OUT = /\b(one line|single sentence|a word|yes or no|just the|only the|briefly|one paragraph)\w*/i;

const TIER_NAME = ['minimal', 'light', 'standard', 'frontier'];

export function classify(prompt) {
  const p = String(prompt || '');
  const hits = (rx) => (rx.test(p) ? 1 : 0);

  let mode = 'text';
  for (const m of ['voice', 'video', 'image', 'music', 'transcribe']) {
    if (RX[m].test(p)) { mode = m; break; }
  }
  if (mode === 'text') {
    if (RX.repo.test(p) || RX.app.test(p)) mode = 'repo';
    else if (RX.code.test(p)) mode = 'code';
    else if (RX.search.test(p)) mode = 'search';
    else if (RX.docs.test(p)) mode = 'docs';
  }

  const deep = hits(DEEP);
  const shallow = hits(SHALLOW);
  const stakes = hits(STAKES);
  const volume = hits(VOLUME);

  let tier = 1;
  if (deep) tier += 2;
  if (RX.repo.test(p) && RX.code.test(p)) tier += 1;
  if (shallow && !deep) tier -= 1;
  if (p.length > 900) tier += 1;
  tier = Math.max(0, Math.min(3, tier));

  // Stakes set a floor you cannot cost cut through. Volume pulls the ceiling
  // down, but only when nothing about the task says it has to be right.
  if (stakes) tier = Math.max(tier, 2);
  if (volume && !stakes && !deep) tier = Math.min(tier, 1);

  const promptTokens = Math.ceil(p.length / 4);
  let contextTokens = 0;
  if (RX.repo.test(p)) contextTokens = 60000;
  else if (RX.docs.test(p)) contextTokens = 20000;
  else if (/\b(attached|this document|the pdf|these files)\b/i.test(p)) contextTokens = 12000;

  let outTokens = 800;
  if (LONG_OUT.test(p)) outTokens = 3000;
  if (SHORT_OUT.test(p)) outTokens = 80;
  if (shallow && !LONG_OUT.test(p)) outTokens = Math.min(outTokens, 400);
  if (tier === 3) outTokens = Math.round(outTokens * 1.6);

  return {
    mode,
    tier,
    tierName: TIER_NAME[tier],
    signals: {
      deepReasoning: !!deep,
      shallowTransform: !!shallow,
      highStakes: !!stakes,
      highVolume: !!volume,
      needsRepoContext: RX.repo.test(p),
      needsLiveWeb: RX.search.test(p),
    },
    estimate: {
      inTokens: promptTokens + contextTokens,
      outTokens,
      chars: p.length,
      seconds: mode === 'video' ? 8 : 0,
      images: mode === 'image' ? 1 : 0,
      minutes: mode === 'transcribe' ? 10 : 0,
      tracks: mode === 'music' ? 1 : 0,
    },
  };
}

function unitCost(model, est) {
  if (model.seat) return { perCall: 0, seat: model.seat, unit: 'seat' };
  switch (model.unit) {
    case 'char': return { perCall: (est.chars / 1000) * model.in, unit: 'per 1k chars' };
    case 'second': return { perCall: est.seconds * model.in, unit: 'per second' };
    case 'image': return { perCall: est.images * model.in, unit: 'per image' };
    case 'minute': return { perCall: est.minutes * model.in, unit: 'per minute' };
    case 'track': return { perCall: est.tracks * model.in, unit: 'per track' };
    default:
      return {
        perCall: (est.inTokens / 1e6) * model.in + (est.outTokens / 1e6) * model.out,
        unit: 'per call',
      };
  }
}

function eligible(task) {
  const wanted = {
    repo: ['repo', 'code'],
    code: ['code'],
    search: ['search', 'text'],
    docs: ['docs', 'text'],
    voice: ['voice'],
    video: ['video'],
    image: ['image'],
    music: ['music'],
    transcribe: ['transcribe'],
    text: ['text'],
  }[task.mode] || ['text'];

  let pool = MODELS.filter((m) => m.modes.some((x) => wanted.includes(x)));
  if (task.mode === 'search') pool = pool.filter((m) => m.modes.includes('search') || m.tier >= 2);
  if (task.signals.needsRepoContext) pool = pool.filter((m) => !m.ctx || m.ctx >= 128000);
  return pool.length ? pool : MODELS.filter((m) => m.modes.includes('text'));
}

export function recommend(prompt, { monthlyCalls = 10000 } = {}) {
  const task = classify(prompt);
  const pool = eligible(task);

  const priced = pool.map((m) => {
    const cost = unitCost(m, task.estimate);
    const gap = m.tier - task.tier;
    // Under tier is disqualifying. Over tier is money burned for nothing.
    const fit = gap < 0 ? -1000 + gap * 50 : 100 - gap * 22;
    return { model: m, cost, gap, fit };
  });

  // Seat priced tools cost nothing per call, which would let them win every
  // comparison on a technicality. They are a different purchase, so they get
  // their own list and only enter the metered ranking if nothing else fits.
  const metered = priced.filter((x) => !x.model.seat);
  const seated = priced.filter((x) => x.model.seat && x.gap >= 0);

  const field = metered.length ? metered : priced;
  const qualified = field.filter((x) => x.gap >= 0);
  const ranked = (qualified.length ? qualified : field).sort((a, b) => b.fit - a.fit || a.cost.perCall - b.cost.perCall);

  const pick = [...(qualified.length ? qualified : field)]
    .sort((a, b) => a.cost.perCall - b.cost.perCall || b.fit - a.fit)[0];
  const flagship = [...field].sort((a, b) => b.cost.perCall - a.cost.perCall || b.model.tier - a.model.tier)[0];

  const perCall = pick.cost.perCall;
  const naive = flagship.cost.perCall;
  const monthly = perCall * monthlyCalls;
  const naiveMonthly = naive * monthlyCalls;

  return {
    task,
    pricesChecked: PRICES_CHECKED,
    pick: {
      ...pick.model,
      costPerCall: round(perCall),
      unit: pick.cost.unit,
      seat: pick.cost.seat || null,
      why: reason(task, pick.model),
    },
    alternatives: ranked
      .filter((x) => x.model.id !== pick.model.id)
      .slice(0, 4)
      .map((x) => ({
        id: x.model.id, tool: x.model.tool, label: x.model.label, tier: x.model.tier,
        costPerCall: round(x.cost.perCall), note: x.model.note,
        delta: round(x.cost.perCall - perCall),
      })),
    subscriptions: seated.map((x) => ({
      id: x.model.id, tool: x.model.tool, label: x.model.label,
      seatUsd: x.model.seat, note: x.model.note,
    })),
    cautions: cautions(task, pick.model),
    economics: {
      monthlyCalls,
      perCall: round(perCall),
      monthly: round(monthly),
      naiveModel: flagship.model.label,
      naivePerCall: round(naive),
      naiveMonthly: round(naiveMonthly),
      savedMonthly: round(naiveMonthly - monthly),
      savedPct: naiveMonthly > 0 ? Math.round(((naiveMonthly - monthly) / naiveMonthly) * 100) : 0,
    },
  };
}

function reason(task, model) {
  const bits = [];
  if (task.signals.highStakes) bits.push('stakes language holds the floor at standard tier or above');
  if (task.signals.highVolume && !task.signals.highStakes) bits.push('volume language caps the tier, this runs too often to overpay');
  if (task.signals.deepReasoning) bits.push('the ask needs real reasoning, not a transform');
  if (task.signals.shallowTransform && !task.signals.deepReasoning) bits.push('this is a transform, a frontier model adds nothing');
  if (task.signals.needsRepoContext) bits.push('repo scope needs a large context window');
  if (task.signals.needsLiveWeb) bits.push('needs live web grounding');
  if (!bits.length) bits.push('no signals pushing it up or down, standard work');
  return `${model.label} is the cheapest ${task.mode} model at ${task.tierName} tier: ${bits.join(', ')}.`;
}

function cautions(task, model) {
  const out = [];
  if (task.signals.highStakes) {
    out.push('This prompt uses high stakes language. Cost is not the only axis here, and the cheapest qualifying model is still the cheapest one. Have a person sign off before this routing goes live.');
  }
  if (task.signals.highStakes && model.tier <= 2) {
    out.push(`${model.label} clears the tier floor but sits at the bottom of it. Consider one tier up for anything with legal or clinical exposure.`);
  }
  if (task.estimate.inTokens > 100000) {
    out.push('The context estimate is large and guessed from wording, not measured. Feed real token counts in before trusting the monthly figure.');
  }
  out.push('Data residency, retention terms and vendor approval are not modelled here. Those rule models out regardless of price.');
  return out;
}

const round = (n) => Math.round(n * 1e6) / 1e6;

export function catalogue() {
  return { pricesChecked: PRICES_CHECKED, models: MODELS };
}
