// Model catalogue used by Dispatch.
//
// PRICES ARE AN APPROXIMATE SNAPSHOT, not a live feed. They are list prices in
// USD per million tokens, taken from public pricing pages. Vendors change them
// without notice and negotiated enterprise rates differ, so treat these as a
// starting point and edit them before anyone makes a budget decision on the
// output. Everything else in Dispatch reads from this file, so one edit here
// updates the whole surface.

export const PRICES_CHECKED = '2026-08';

// tier 0 cheap and shallow, 1 fast general, 2 solid mid, 3 frontier reasoning
export const MODELS = [
  { id: 'claude-opus-5', tool: 'Claude', slug: 'claude', provider: 'anthropic', label: 'Claude Opus 5', tier: 3, modes: ['text', 'code', 'vision'], in: 15, out: 75, ctx: 200000, note: 'Deep reasoning, long refactors, high stakes writing.' },
  { id: 'claude-sonnet-5', tool: 'Claude', slug: 'claude', provider: 'anthropic', label: 'Claude Sonnet 5', tier: 2, modes: ['text', 'code', 'vision'], in: 3, out: 15, ctx: 200000, note: 'The default workhorse. Most tasks land here.' },
  { id: 'claude-fable-5', tool: 'Claude', slug: 'claude', provider: 'anthropic', label: 'Claude Fable 5', tier: 2, modes: ['text'], in: 3, out: 15, ctx: 200000, note: 'Tuned for narrative and voice driven prose.' },
  { id: 'claude-haiku-4-5', tool: 'Claude', slug: 'claude', provider: 'anthropic', label: 'Claude Haiku 4.5', tier: 1, modes: ['text', 'code'], in: 1, out: 5, ctx: 200000, note: 'Fast and cheap for classification and extraction.' },

  { id: 'gpt-5.2', tool: 'ChatGPT', slug: 'chatgpt', provider: 'openai', label: 'GPT-5.2', tier: 3, modes: ['text', 'code', 'vision'], in: 10, out: 40, ctx: 400000, note: 'Broad frontier model, strong tool use.' },
  { id: 'gpt-4o', tool: 'ChatGPT', slug: 'chatgpt', provider: 'openai', label: 'GPT-4o', tier: 2, modes: ['text', 'code', 'vision'], in: 2.5, out: 10, ctx: 128000, note: 'Cheap multimodal mid tier, widely available.' },
  { id: 'gpt-4o-mini', tool: 'ChatGPT', slug: 'chatgpt', provider: 'openai', label: 'GPT-4o mini', tier: 0, modes: ['text', 'vision'], in: 0.15, out: 0.6, ctx: 128000, note: 'Bulk classification and tagging at near zero cost.' },

  { id: 'gemini-3-pro', tool: 'Gemini', slug: 'gemini', provider: 'google', label: 'Gemini 3 Pro', tier: 3, modes: ['text', 'code', 'vision', 'video'], in: 1.25, out: 10, ctx: 1000000, note: 'Frontier reasoning with a very large context window.' },
  { id: 'gemini-3-flash', tool: 'Gemini', slug: 'gemini', provider: 'google', label: 'Gemini 3 Flash', tier: 1, modes: ['text', 'code', 'vision'], in: 0.3, out: 2.5, ctx: 1000000, note: 'Long context on a budget. Good for document sweeps.' },
  { id: 'gemini-3-flash-lite', tool: 'Gemini', slug: 'gemini', provider: 'google', label: 'Gemini 3 Flash Lite', tier: 0, modes: ['text'], in: 0.1, out: 0.4, ctx: 1000000, note: 'The floor. Routing, tagging, dedupe.' },

  { id: 'grok-4', tool: 'Grok', slug: 'grok', provider: 'xai', label: 'Grok 4', tier: 2, modes: ['text', 'code'], in: 3, out: 15, ctx: 256000, note: 'Strong on current events and informal tone.' },
  { id: 'deepseek-v4', tool: 'DeepSeek', slug: 'deepseek', provider: 'deepseek', label: 'DeepSeek V4', tier: 2, modes: ['text', 'code'], in: 0.27, out: 1.1, ctx: 128000, note: 'Cheapest credible coding model by a wide margin.' },
  { id: 'mistral-large-3', tool: 'Mistral', slug: 'mistral-ai', provider: 'mistral-ai', label: 'Mistral Large 3', tier: 2, modes: ['text', 'code'], in: 2, out: 6, ctx: 128000, note: 'EU hosted option when data residency matters.' },
  { id: 'llama-4-405b', tool: 'Llama', slug: 'meta-llama', provider: 'groq', label: 'Llama 4 405B', tier: 1, modes: ['text', 'code'], in: 0.9, out: 0.9, ctx: 128000, note: 'Open weights, self hostable, flat pricing.' },
  { id: 'perplexity-sonar', tool: 'Perplexity', slug: 'perplexity', provider: 'perplexity', label: 'Perplexity Sonar', tier: 1, modes: ['text', 'search'], in: 1, out: 1, ctx: 128000, note: 'Live web grounding with citations built in.' },

  { id: 'cursor-agent', tool: 'Cursor', slug: 'cursor', provider: 'cursor', label: 'Cursor Composer', tier: 3, modes: ['code', 'repo'], in: 0, out: 0, seat: 20, ctx: 200000, note: 'Multi file edits inside an indexed repo.' },
  { id: 'claude-code', tool: 'Claude Code', slug: 'claude-code', provider: 'anthropic', label: 'Claude Code', tier: 3, modes: ['code', 'repo', 'shell'], in: 15, out: 75, ctx: 200000, note: 'Terminal agent with shell and file access.' },
  { id: 'lovable', tool: 'Lovable', slug: 'lovable', provider: 'lovable', label: 'Lovable', tier: 2, modes: ['code', 'app'], in: 0, out: 0, seat: 25, ctx: 0, note: 'Prompt to deployed web app, no local setup.' },
  { id: 'notion-ai', tool: 'Notion AI', slug: 'notion-ai', provider: 'notion', label: 'Notion AI', tier: 1, modes: ['text', 'docs'], in: 0, out: 0, seat: 10, ctx: 0, note: 'Writing and search inside an existing workspace.' },

  { id: 'elevenlabs-v3', tool: 'ElevenLabs', slug: 'elevenlabs', provider: 'elevenlabs', label: 'ElevenLabs v3', tier: 3, modes: ['voice'], unit: 'char', in: 0.11, out: 0, ctx: 0, note: 'Audio tags and emotional direction. Costs more per character.' },
  { id: 'elevenlabs-turbo', tool: 'ElevenLabs', slug: 'elevenlabs', provider: 'elevenlabs', label: 'ElevenLabs Turbo v2.5', tier: 1, modes: ['voice'], unit: 'char', in: 0.055, out: 0, ctx: 0, note: 'Half the price, no audio tag support, low latency.' },
  { id: 'openai-tts', tool: 'ChatGPT', slug: 'chatgpt', provider: 'openai', label: 'OpenAI TTS', tier: 0, modes: ['voice'], unit: 'char', in: 0.015, out: 0, ctx: 0, note: 'Cheapest usable narration. Flat delivery.' },

  { id: 'veo', tool: 'Veo', slug: 'veo', provider: 'google', label: 'Veo', tier: 3, modes: ['video'], unit: 'second', in: 0.5, out: 0, ctx: 0, note: 'Highest fidelity generation, priced per second.' },
  { id: 'runway-gen4', tool: 'Runway', slug: 'runway', provider: 'runway', label: 'Runway Gen-4', tier: 2, modes: ['video'], unit: 'second', in: 0.25, out: 0, ctx: 0, note: 'Faster iteration, good image to video adherence.' },
  { id: 'nano-banana', tool: 'Nano Banana', slug: 'nano-banana', provider: 'google', label: 'Nano Banana', tier: 2, modes: ['image'], unit: 'image', in: 0.04, out: 0, ctx: 0, note: 'Strong editing and character consistency.' },
  { id: 'flux-schnell', tool: 'Flux', slug: 'flux', provider: 'fal', label: 'Flux Schnell', tier: 0, modes: ['image'], unit: 'image', in: 0.003, out: 0, ctx: 0, note: 'Draft and thumbnail volume work.' },
  { id: 'whisper', tool: 'Whisper', slug: 'whisper', provider: 'openai', label: 'Whisper', tier: 1, modes: ['transcribe'], unit: 'minute', in: 0.006, out: 0, ctx: 0, note: 'Transcription at a fraction of a cent per minute.' },
  { id: 'suno', tool: 'Suno', slug: 'suno', provider: 'suno', label: 'Suno', tier: 2, modes: ['music'], unit: 'track', in: 0.1, out: 0, ctx: 0, note: 'Full tracks with vocals or instrumental beds.' },
];

export const byId = (id) => MODELS.find((m) => m.id === id) || null;
