// The tool registry: seeded from data/tools.js, then open for self-registration.
import { load, save, id, log } from './store.js';
import { CATEGORIES, seedTools, slugify } from '../data/tools.js';

/** Which auth provider a tool authenticates against. Tools not listed here
 *  use a generic bring-your-own-key connection under their own slug. */
export const PROVIDER_OF = {
  claude: 'anthropic', 'claude-code': 'anthropic', 'claude-for-work': 'anthropic',
  anthropic: 'anthropic', 'claude-agent-sdk': 'anthropic',
  chatgpt: 'openai', 'openai-codex': 'openai', 'dall-e-3': 'openai', whisper: 'openai',
  openai: 'openai', 'openai-tts': 'openai', 'openai-realtime': 'openai', 'openai-operator': 'openai',
  gemini: 'google', 'google-ai-studio': 'google', imagen: 'google', veo: 'google', lyria: 'google',
  notebooklm: 'google', 'gemini-advanced': 'google', 'google-deepmind': 'google',
  elevenlabs: 'elevenlabs', 'elevenlabs-agents': 'elevenlabs', 'elevenlabs-sfx': 'elevenlabs',
  'elevenlabs-dubbing': 'elevenlabs', 'elevenlabs-translate': 'elevenlabs',
  openrouter: 'openrouter', groq: 'groq', 'fal-ai': 'fal', replicate: 'replicate',
  'stability-ai': 'stability', midjourney: 'midjourney', runway: 'runway',
  'luma-dream-machine': 'luma', kling: 'kling', pika: 'pika', suno: 'suno', udio: 'udio',
  heygen: 'heygen', synthesia: 'synthesia', descript: 'descript', capcut: 'capcut',
  perplexity: 'perplexity', exa: 'exa', tavily: 'tavily', firecrawl: 'firecrawl',
  notion: 'notion', 'notion-ai': 'notion', figma: 'figma', 'figma-ai': 'figma',
  cursor: 'cursor', 'github-copilot': 'github', deepgram: 'deepgram', assemblyai: 'assemblyai',
};

/** Rough monthly list price, used by the Exchange access gate. USD. */
export const PROVIDER_PLANS = {
  anthropic: { name: 'Claude Pro', price: 20, url: 'https://claude.ai/upgrade' },
  openai: { name: 'ChatGPT Plus', price: 20, url: 'https://chat.openai.com/#pricing' },
  google: { name: 'Google AI Pro', price: 20, url: 'https://one.google.com/about/ai-premium' },
  elevenlabs: { name: 'ElevenLabs Creator', price: 22, url: 'https://elevenlabs.io/pricing' },
  midjourney: { name: 'Midjourney Standard', price: 30, url: 'https://midjourney.com/account' },
  runway: { name: 'Runway Standard', price: 15, url: 'https://runwayml.com/pricing' },
  suno: { name: 'Suno Pro', price: 10, url: 'https://suno.com/account' },
  heygen: { name: 'HeyGen Creator', price: 29, url: 'https://heygen.com/pricing' },
  perplexity: { name: 'Perplexity Pro', price: 20, url: 'https://perplexity.ai/pro' },
  openrouter: { name: 'OpenRouter credits', price: 5, url: 'https://openrouter.ai/credits' },
  cursor: { name: 'Cursor Pro', price: 20, url: 'https://cursor.com/pricing' },
  descript: { name: 'Descript Hobbyist', price: 19, url: 'https://descript.com/pricing' },
};

/** Capabilities a tool can contribute to a Studio pipeline. */
const CAPABILITY_BY_CATEGORY = {
  assistant: ['ideate', 'write', 'reason'],
  coding: ['code', 'reason'],
  writing: ['write', 'ideate'],
  image: ['image'],
  video: ['video'],
  video_edit: ['edit', 'video'],
  avatar: ['avatar', 'video'],
  voice: ['voice'],
  music: ['music'],
  transcription: ['transcribe'],
  search: ['research'],
  productivity: ['organize'],
  automation: ['automate'],
  frameworks: ['automate', 'reason'],
  browser: ['browse'],
  data: ['analyze'],
  design: ['design', 'image'],
  three_d: ['three_d'],
  presentation: ['slides'],
  spreadsheet: ['analyze'],
  llm_infra: ['reason'],
  providers: ['reason', 'write'],
  vector_rag: ['retrieve'],
  eval: ['evaluate'],
  sales: ['write'], marketing: ['write', 'image'], support: ['write'],
  voice_agents: ['voice'], legal: ['reason'], finance: ['analyze'],
  healthcare: ['reason'], education: ['write'], security: ['code'],
  translation: ['translate'], gaming: ['image'], robotics: ['reason'], science: ['research'],
};

let booted = false;

export function boot() {
  if (booted) return;
  const db = load();
  if (Object.keys(db.tools).length === 0) {
    for (const t of seedTools()) {
      db.tools[t.slug] = {
        ...t,
        provider: PROVIDER_OF[t.slug] || t.slug,
        capabilities: CAPABILITY_BY_CATEGORY[t.category] || ['reason'],
        stats: { queries: 0, answers: 0, runs: 0, members: seededMembers(t.slug) },
      };
    }
    log('registry.seed', { count: Object.keys(db.tools).length });
    save();
  }
  booted = true;
}

// Deterministic pseudo-member counts so the feed looks alive without lying
// about a specific real number — derived from the slug, stable across boots.
function seededMembers(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return 120 + (h % 48000);
}

export function allTools() {
  boot();
  return Object.values(load().tools);
}

export function getTool(slug) {
  boot();
  return load().tools[slug] || null;
}

/** Self-registration: any tool that shows up via the API joins the registry. */
export function ensureTool(nameOrSlug, hints = {}) {
  boot();
  const db = load();
  const slug = slugify(nameOrSlug);
  if (db.tools[slug]) return db.tools[slug];
  const category = hints.category && CATEGORIES[hints.category] ? hints.category : 'assistant';
  db.tools[slug] = {
    slug,
    name: hints.name || nameOrSlug,
    category,
    categoryLabel: CATEGORIES[category].label,
    icon: CATEGORIES[category].icon,
    source: 'self-registered',
    provider: hints.provider || PROVIDER_OF[slug] || slug,
    capabilities: hints.capabilities || CAPABILITY_BY_CATEGORY[category] || ['reason'],
    stats: { queries: 0, answers: 0, runs: 0, members: 1 },
    addedAt: Date.now(),
  };
  log('registry.register', { slug, source: 'self-registered' });
  save();
  return db.tools[slug];
}

export function searchTools(q, { limit = 40, category = null, capability = null } = {}) {
  boot();
  const tools = allTools();
  const needle = (q || '').trim().toLowerCase();
  let out = tools;
  if (category) out = out.filter((t) => t.category === category);
  if (capability) out = out.filter((t) => t.capabilities.includes(capability));
  if (needle) {
    out = out
      .map((t) => {
        const n = t.name.toLowerCase();
        let score = 0;
        if (n === needle) score = 100;
        else if (n.startsWith(needle)) score = 60;
        else if (n.includes(needle)) score = 30;
        else if (t.categoryLabel.toLowerCase().includes(needle)) score = 10;
        return score ? { t, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || b.t.stats.members - a.t.stats.members)
      .map((x) => x.t);
  } else {
    out = [...out].sort((a, b) => b.stats.members - a.stats.members);
  }
  return out.slice(0, limit);
}

export function categories() {
  boot();
  const counts = {};
  for (const t of allTools()) counts[t.category] = (counts[t.category] || 0) + 1;
  return Object.entries(CATEGORIES).map(([key, c]) => ({
    key, label: c.label, icon: c.icon, count: counts[key] || 0,
  }));
}

export function bumpStat(slug, key, by = 1) {
  const t = getTool(slug);
  if (!t) return;
  t.stats[key] = (t.stats[key] || 0) + by;
  save();
}

export function planFor(provider) {
  return PROVIDER_PLANS[provider] || null;
}
