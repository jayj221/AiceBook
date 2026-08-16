// Keys are read from the environment at call time and never written to the
// store. If a key is missing the step runs in preview mode and says so.

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

const TEXT_CAPABILITIES = ['ideate', 'write', 'reason', 'code', 'analyze', 'translate'];

export function keyFor(provider) {
  const name = PROVIDER_ENV[provider];
  if (!name) return null;
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function connectionStatus(provider) {
  const envVar = PROVIDER_ENV[provider] || `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  return { provider, envVar, live: !!keyFor(provider) };
}

async function anthropicText({ prompt, system, model = 'claude-opus-4-5', maxTokens = 1200 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': keyFor('anthropic'),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  return {
    text: (body.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
    usage: body.usage,
    model: body.model,
  };
}

async function openaiText({ prompt, system, model = 'gpt-5.2', maxTokens = 1200 }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${keyFor('openai')}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  return { text: body.choices?.[0]?.message?.content || '', usage: body.usage, model: body.model };
}

async function googleText({ prompt, system, model = 'gemini-3-pro' }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyFor('google')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  return {
    text: (body.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('\n'),
    usage: body.usageMetadata,
    model,
  };
}

async function elevenlabsVoice({ prompt, voiceId = 'JBFqnCBsd6RMkjVDRZzb', model = 'eleven_v3' }) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': keyFor('elevenlabs') },
    body: JSON.stringify({ text: prompt, model_id: model }),
  });
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { audioBase64: buf.toString('base64'), mime: 'audio/mpeg', bytes: buf.length, model };
}

const TEXT_ADAPTERS = { anthropic: anthropicText, openai: openaiText, google: googleText };

function clip(s, n = 60) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '...' : t;
}

function preview({ tool, capability, prompt, upstream }) {
  const shapes = {
    ideate: () => `[${tool.name}] 5 angles on "${clip(prompt)}":\n1. Contrarian take\n2. Beginner walkthrough\n3. Behind the scenes build\n4. Myth vs fact teardown\n5. 60 second cold open`,
    write: () => `[${tool.name}] Draft for "${clip(prompt)}"\n\nHook (0:00-0:03): open on the result, not the setup.\nBody (0:03-0:40): three beats, one claim each.\nClose (0:40-0:55): restate the promise, single CTA.`,
    research: () => `[${tool.name}] 4 sources gathered for "${clip(prompt)}". Connect a key to retrieve live results.`,
    image: () => `[${tool.name}] image job queued, 1024x1024, prompt="${clip(prompt, 80)}"`,
    video: () => `[${tool.name}] video job queued, 1080p, 8s, prompt="${clip(prompt, 80)}"`,
    voice: () => `[${tool.name}] narration rendered, about ${Math.max(4, Math.round(prompt.length / 14))}s`,
    music: () => `[${tool.name}] score generated, 90 BPM, instrumental bed`,
    edit: () => `[${tool.name}] timeline assembled from ${upstream.length} upstream asset(s), captions burned in`,
    transcribe: () => `[${tool.name}] transcript ready, ${Math.max(1, Math.round(prompt.length / 90))} segments`,
    avatar: () => `[${tool.name}] presenter clip rendered from script`,
    code: () => `[${tool.name}] patch proposed for "${clip(prompt)}"`,
    analyze: () => `[${tool.name}] analysis over ${upstream.length} input(s)`,
  };
  const shape = shapes[capability] || (() => `[${tool.name}] ${capability} step completed for "${clip(prompt)}"`);
  const context = upstream.filter(Boolean).join('\n').slice(0, 400);
  const body = shape();
  return context ? `${body}\n\nbuilt on upstream: ${clip(context, 160)}` : body;
}

function withUpstream(prompt, upstream) {
  const context = upstream
    .filter(Boolean)
    .map((u, i) => `[input ${i + 1}]\n${u}`)
    .join('\n\n');
  return context ? `${context}\n\n---\n${prompt}` : prompt;
}

export async function runStep({ tool, capability, prompt, system, upstream = [], params = {} }) {
  const provider = tool.provider;

  if (keyFor(provider)) {
    try {
      if (TEXT_ADAPTERS[provider] && TEXT_CAPABILITIES.includes(capability)) {
        const r = await TEXT_ADAPTERS[provider]({ prompt: withUpstream(prompt, upstream), system, ...params });
        return { output: r.text, simulated: false, provider, meta: { model: r.model, usage: r.usage } };
      }
      if (provider === 'elevenlabs' && capability === 'voice') {
        const r = await elevenlabsVoice({ prompt: withUpstream(prompt, upstream), ...params });
        return {
          output: `audio:${r.bytes}B`,
          audio: r.audioBase64,
          simulated: false,
          provider,
          meta: { model: r.model },
        };
      }
    } catch (err) {
      return { output: null, simulated: false, provider, error: err.message };
    }
  }

  return {
    output: preview({ tool, capability, prompt, upstream }),
    simulated: true,
    provider,
    note: PROVIDER_ENV[provider]
      ? `preview only, set ${PROVIDER_ENV[provider]} to run this step live`
      : `preview only, no adapter written for ${provider} yet`,
  };
}
