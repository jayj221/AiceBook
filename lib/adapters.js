// Execution layer. Each adapter turns a Studio step into a real provider call.
//
// KEY HANDLING: AI'sBook never writes raw API keys into data/store.json.
// A connection stores only the NAME of the env var holding the key. If the
// env var is absent the step runs in `simulated` mode and says so, loudly —
// a fake result that pretends to be real is the exact failure this whole
// product exists to prevent.

export const PROVIDER_ENV = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  replicate: 'REPLICATE_API_TOKEN',
  fal: 'FAL_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  exa: 'EXA_API_KEY',
  tavily: 'TAVILY_API_KEY',
  firecrawl: 'FIRECRAWL_API_KEY',
  deepgram: 'DEEPGRAM_API_KEY',
  assemblyai: 'ASSEMBLYAI_API_KEY',
  stability: 'STABILITY_API_KEY',
  heygen: 'HEYGEN_API_KEY',
  runway: 'RUNWAY_API_KEY',
};

export function keyFor(provider) {
  const envName = PROVIDER_ENV[provider];
  if (!envName) return null;
  const v = process.env[envName];
  return v && v.trim() ? v.trim() : null;
}

export function connectionStatus(provider) {
  const envName = PROVIDER_ENV[provider] || `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  return { provider, envVar: envName, live: !!keyFor(provider) };
}

// ---- real adapters ----------------------------------------------------

async function anthropicText({ prompt, system, model = 'claude-opus-4-5', maxTokens = 1200 }) {
  const key = keyFor('anthropic');
  if (!key) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return {
    text: (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
    usage: j.usage, model: j.model,
  };
}

async function openaiText({ prompt, system, model = 'gpt-5.2', maxTokens = 1200 }) {
  const key = keyFor('openai');
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, max_completion_tokens: maxTokens,
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return { text: j.choices?.[0]?.message?.content || '', usage: j.usage, model: j.model };
}

async function googleText({ prompt, system, model = 'gemini-3-pro' }) {
  const key = keyFor('google');
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return {
    text: (j.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('\n'),
    usage: j.usageMetadata, model,
  };
}

async function elevenlabsVoice({ prompt, voiceId = 'JBFqnCBsd6RMkjVDRZzb', model = 'eleven_v3' }) {
  const key = keyFor('elevenlabs');
  if (!key) return null;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({ text: prompt, model_id: model }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { audioBase64: buf.toString('base64'), mime: 'audio/mpeg', bytes: buf.length, model };
}

const TEXT_ADAPTERS = { anthropic: anthropicText, openai: openaiText, google: googleText };

// ---- simulated fallback ----------------------------------------------

function simulate({ tool, capability, prompt, upstream }) {
  const ctx = upstream.filter(Boolean).join('\n').slice(0, 400);
  const shapes = {
    ideate: () => `[${tool.name}] 5 angles on "${clip(prompt)}":\n1. Contrarian take\n2. Beginner walkthrough\n3. Behind-the-scenes build\n4. Myth-vs-fact teardown\n5. 60-second cold open`,
    write: () => `[${tool.name}] Draft for "${clip(prompt)}"\n\nHook (0:00-0:03) — open on the result, not the setup.\nBody (0:03-0:40) — three beats, one claim each.\nClose (0:40-0:55) — restate the promise, single CTA.`,
    research: () => `[${tool.name}] 4 sources gathered for "${clip(prompt)}". Simulated — connect a key to retrieve live results.`,
    image: () => `[${tool.name}] image job queued · 1024x1024 · prompt="${clip(prompt, 80)}"`,
    video: () => `[${tool.name}] video job queued · 1080p · 8s · prompt="${clip(prompt, 80)}"`,
    voice: () => `[${tool.name}] narration rendered · ~${Math.max(4, Math.round(prompt.length / 14))}s`,
    music: () => `[${tool.name}] score generated · 90 BPM · instrumental bed`,
    edit: () => `[${tool.name}] timeline assembled from ${upstream.length} upstream asset(s), captions burned in`,
    transcribe: () => `[${tool.name}] transcript ready · ${Math.max(1, Math.round(prompt.length / 90))} segments`,
    avatar: () => `[${tool.name}] presenter clip rendered from script`,
    code: () => `[${tool.name}] patch proposed for "${clip(prompt)}"`,
    analyze: () => `[${tool.name}] analysis over ${upstream.length} input(s)`,
  };
  const body = (shapes[capability] || (() => `[${tool.name}] ${capability} step completed for "${clip(prompt)}"`))();
  return { text: ctx ? `${body}\n\n— built on upstream: ${clip(ctx, 160)}` : body };
}

function clip(s, n = 60) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ---- public entry point ----------------------------------------------

/**
 * Run one Studio step.
 * @returns {{ output:any, simulated:boolean, provider:string, note?:string, error?:string }}
 */
export async function runStep({ tool, capability, prompt, system, upstream = [], params = {} }) {
  const provider = tool.provider;
  const live = !!keyFor(provider);

  if (live) {
    try {
      if (TEXT_ADAPTERS[provider] && ['ideate', 'write', 'reason', 'code', 'analyze', 'translate'].includes(capability)) {
        const r = await TEXT_ADAPTERS[provider]({ prompt: buildPrompt(prompt, upstream), system, ...params });
        return { output: r.text, simulated: false, provider, meta: { model: r.model, usage: r.usage } };
      }
      if (provider === 'elevenlabs' && capability === 'voice') {
        const r = await elevenlabsVoice({ prompt: buildPrompt(prompt, upstream), ...params });
        return { output: `audio:${r.bytes}B`, audio: r.audioBase64, simulated: false, provider, meta: { model: r.model } };
      }
    } catch (err) {
      return { output: null, simulated: false, provider, error: err.message };
    }
  }

  const sim = simulate({ tool, capability, prompt, upstream });
  return {
    output: sim.text,
    simulated: true,
    provider,
    note: PROVIDER_ENV[provider]
      ? `simulated — set ${PROVIDER_ENV[provider]} to run this step live`
      : `simulated — no adapter implemented for ${provider} yet`,
  };
}

function buildPrompt(prompt, upstream) {
  const ctx = upstream.filter(Boolean).map((u, i) => `[input ${i + 1}]\n${u}`).join('\n\n');
  return ctx ? `${ctx}\n\n---\n${prompt}` : prompt;
}
