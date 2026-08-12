// Curated registry of real gen-AI tools, grouped by capability.
// This is the SEED. The registry is open: any tool that calls the API
// self-registers (see lib/registry.js#ensureTool), which is how the long
// tail past this list gets covered without us pretending to have typed it.
//
// Format: category -> pipe-delimited tool names. Slugs are derived.

export const CATEGORIES = {
  assistant: {
    label: 'Assistants & Chat',
    icon: '💬',
    tools: 'ChatGPT|Claude|Gemini|Grok|Microsoft Copilot|Perplexity|Meta AI|DeepSeek|Qwen Chat|Kimi|Le Chat|Poe|You.com|Pi|Character.AI|HuggingChat|Cohere Coral|Reka|Jamba|Ernie Bot|Doubao|Hunyuan|GLM|Yi Chat|Nova|Inflection|Copilot Pro|Gemini Advanced|ChatGPT Enterprise|Claude for Work',
  },
  coding: {
    label: 'Coding & Agents',
    icon: '⌨️',
    tools: 'Cursor|Claude Code|GitHub Copilot|Windsurf|Codeium|Cline|Aider|Continue|Sourcegraph Cody|Tabnine|Replit Agent|Bolt.new|v0|Lovable|Devin|OpenAI Codex|Zed|JetBrains AI|Amazon Q Developer|Qodo|Sweep|Augment Code|Warp|Supermaven|Trae|Kiro|Antigravity|OpenHands|SWE-agent|Roo Code|Kilo Code|Goose|Jules|Firebase Studio|Google AI Studio|Junie|Pythagora|GPT Engineer|Smol Developer|Mentat|Refact|Codebuff|Melty|PearAI|Void|Cody Enterprise|CodeRabbit|Greptile|Ellipsis|Graphite Diamond|Korbit|Bito|Sourcery',
  },
  writing: {
    label: 'Writing & Docs',
    icon: '✍️',
    tools: 'Notion AI|Jasper|Copy.ai|Writesonic|Rytr|Sudowrite|Grammarly|Wordtune|QuillBot|Lex|Type|HyperWrite|Anyword|Frase|Surfer SEO|MarketMuse|Clearscope|Scalenut|Byword|Longshot|Textio|Writer|Tome|Gamma|Slite AI|Craft AI|Bear AI|Ulysses|Scrivener AI|NovelAI|Squibler|Raptor Write|Hemingway',
  },
  image: {
    label: 'Image Generation',
    icon: '🎨',
    tools: 'Midjourney|DALL-E 3|Stable Diffusion|Flux|Ideogram|Leonardo.ai|Adobe Firefly|Recraft|Krea|Playground|Nano Banana|Imagen|Freepik AI|Canva Magic Studio|Photoroom|Clipdrop|Magnific|Topaz Photo AI|Bria|Scenario|Civitai|ComfyUI|Automatic1111|Fooocus|InvokeAI|Draw Things|NightCafe|Artbreeder|Lexica|Dreamlike|Pixlr AI|Picsart AI|Remini|Lensa|Vance AI|Let\'s Enhance|Upscayl|Aragon|Headshot Pro|PhotoAI|Flair|Pebblely|Booth.ai|Mokker|Stylar|Vizcom|Uncrop',
  },
  video: {
    label: 'Video Generation',
    icon: '🎬',
    tools: 'Sora|Veo|Runway|Pika|Luma Dream Machine|Kling|Hailuo|MiniMax Video|Haiper|Mochi|LTX Studio|Higgsfield|Wan|Seedance|Vidu|PixVerse|Kaiber|Domo AI|Viggle|Genmo|Morph Studio|Neural Frames|Deforum|AnimateDiff|Stable Video Diffusion|Krea Video|Freepik Video|Hedra|Lightricks LTX|Moonvalley|Ray3',
  },
  video_edit: {
    label: 'Video Editing',
    icon: '✂️',
    tools: 'CapCut|Descript|Opus Clip|Veed|InVideo|Pictory|Fliki|Filmora|Premiere Pro AI|DaVinci Resolve Neural|Final Cut AI|Topaz Video AI|Kapwing|Clipchamp|Vizard|Munch|Klap|Submagic|Vidyo.ai|Wisecut|Runway Edit|Adobe Podcast Video|Gling|Timebolt|AutoPod|Recut|Riverside|StreamYard AI|Milk Video|Tella|Loom AI|Guidde|Arcade|Supademo|Scribe',
  },
  avatar: {
    label: 'Avatars & Presenters',
    icon: '🧑‍💼',
    tools: 'Synthesia|HeyGen|D-ID|Colossyan|Elai|Hour One|Captions|Argil|Creatify|Arcads|Yepic|Rephrase|DeepBrain|Vidnoz|Akool|Tavus|Soul Machines|Inworld|Convai|Ready Player Me',
  },
  voice: {
    label: 'Voice & Speech',
    icon: '🎙️',
    tools: 'ElevenLabs|PlayHT|Resemble AI|WellSaid|Murf|Speechify|Cartesia|Fish Audio|Hume|Respeecher|Voicemod|LOVO|Listnr|NaturalReader|Podcastle|Descript Overdub|Camb.ai|Papercup|Deepdub|Rask|HeyGen Translate|Voiser|Uberduck|Coqui|Bark|Kokoro|Chatterbox|OpenAI TTS|Google Cloud TTS|Azure Speech|Amazon Polly',
  },
  music: {
    label: 'Music & Sound',
    icon: '🎵',
    tools: 'Suno|Udio|Stable Audio|Mubert|Soundraw|AIVA|Boomy|Beatoven|Riffusion|Lyria|Splash|Loudly|Ecrett|Soundful|Epidemic AI|Moises|LALAL.AI|iZotope RX|Auphonic|Adobe Podcast Enhance|Krisp|Cleanvoice|Podcast.ai|ElevenLabs SFX|Optimizer',
  },
  transcription: {
    label: 'Transcription & Meetings',
    icon: '📝',
    tools: 'Whisper|Deepgram|AssemblyAI|Otter.ai|Fireflies|Rev|Sonix|Trint|Happy Scribe|Descript Transcribe|Granola|Fathom|Read AI|tl;dv|Sembly|Supernormal|Fellow|Avoma|Grain|Circleback|Spinach|Bluedot|Krisp Notes|Notion AI Meetings|Zoom AI Companion|Teams Copilot|Google Meet Gemini',
  },
  search: {
    label: 'Search & Research',
    icon: '🔎',
    tools: 'Perplexity|Exa|Tavily|Brave Search API|Consensus|Elicit|Scite|SciSpace|Semantic Scholar|Undermind|NotebookLM|Genspark|Felo|Liner|STORM|Deep Research|Gemini Deep Research|GPT Researcher|Bing Copilot|Kagi|Phind|Andi|Komo|iAsk|Arc Search|Devv|Glean Search',
  },
  productivity: {
    label: 'Productivity & Knowledge',
    icon: '📚',
    tools: 'Notion|Obsidian AI|Mem|Reflect|Tana|Coda AI|Slack AI|Microsoft 365 Copilot|Google Workspace Gemini|Glean|Dust|Guru|Sana|Qatalog|Motion|Reclaim|Clockwise|Superhuman|Shortwave|SaneBox|Todoist AI|Asana AI|ClickUp Brain|Monday AI|Linear AI|Height|Trello Butler|Miro AI|FigJam AI|Mural AI|Whimsical AI|Xmind AI|Taskade|Bardeen|Magical',
  },
  automation: {
    label: 'Automation & Workflows',
    icon: '⚡',
    tools: 'Zapier AI|Make|n8n|Lindy|Relevance AI|Gumloop|Vellum|Flowise|Langflow|Dify|Pipedream|Activepieces|Retool AI|Airtable AI|Workato|Tray.ai|Bubble AI|Softr AI|Glide AI|Stack AI|Respell|Wordware|Latitude|Rivet|BuildShip|Windmill|Trigger.dev|Inngest|Temporal|Orkes',
  },
  frameworks: {
    label: 'Agent Frameworks',
    icon: '🧩',
    tools: 'LangChain|LangGraph|LlamaIndex|CrewAI|AutoGen|Semantic Kernel|Haystack|Agno|Mastra|Pydantic AI|Smolagents|OpenAI Agents SDK|Claude Agent SDK|Google ADK|Strands|Atomic Agents|DSPy|Guidance|Outlines|Instructor|BAML|Marvin|Griptape|SuperAGI|MetaGPT|ChatDev|CAMEL|AgentVerse|Swarm|Letta|MemGPT|Zep|Mem0',
  },
  browser: {
    label: 'Browser & Computer Use',
    icon: '🖱️',
    tools: 'Browser Use|Stagehand|Playwright MCP|Claude Computer Use|OpenAI Operator|Skyvern|Multion|Induced|Agent-E|WebVoyager|Browserbase|Steel|Hyperbrowser|Anchor Browser|Kernel|Scrapybara|E2B|Daytona|Modal Sandboxes',
  },
  data: {
    label: 'Data & Analytics',
    icon: '📊',
    tools: 'Hex Magic|Julius AI|Rows AI|Equals|Numerous|Basedash|Seek AI|Defog|Vanna|Databricks Genie|Snowflake Cortex|BigQuery Gemini|Tableau Pulse|ThoughtSpot Sage|Power BI Copilot|Zenlytic|Delphi|Fabi|Omni AI|Lightdash AI|Cube AI|Metabase AI|Preset AI|Sigma AI|Deepnote AI|Hyperarc|Patterns|Bricks',
  },
  design: {
    label: 'Design & Web',
    icon: '🖌️',
    tools: 'Figma AI|Framer AI|Uizard|Galileo AI|Relume|Visily|Locofy|Anima|Builder.io|TeleportHQ|Durable|Wix ADI|Hostinger AI|10Web|Webflow AI|Dora|Motiff|Magician|Musho|Attention Insight|VisualEyes|Khroma|Colormind|Looka|Brandmark|LogoAI|Namelix|Recraft Vector|Vectorizer|SVGmaker',
  },
  three_d: {
    label: '3D & Spatial',
    icon: '🧊',
    tools: 'Luma AI|Polycam|Kaedim|Meshy|Tripo|Rodin|CSM|Sloyd|Spline AI|Masterpiece Studio|Alpha3D|3DFY|Blender AI|NVIDIA Omniverse|Move AI|Wonder Dynamics|Radical|Plask|DeepMotion|Cascadeur',
  },
  presentation: {
    label: 'Slides & Docs Output',
    icon: '📽️',
    tools: 'Gamma|Tome|Beautiful.ai|SlidesAI|Presentations.ai|Plus AI|Decktopus|Pitch AI|Canva Docs|Storydoc|Prezi AI|MagicSlides|ChatBCG|Slidebean|PopAi|Napkin',
  },
  spreadsheet: {
    label: 'Spreadsheets & Docs',
    icon: '🧮',
    tools: 'Excel Copilot|Google Sheets Gemini|Rows|Equals|Bricks|Numerous|SheetAI|GPTExcel|Formula Bot|Ajelix|Coefficient|Paradigm|Clockwork|Airtable Cobuilder',
  },
  llm_infra: {
    label: 'Model Serving & Infra',
    icon: '🏗️',
    tools: 'OpenRouter|Together AI|Fireworks|Replicate|Modal|Baseten|Groq|Cerebras|SambaNova|Anyscale|RunPod|Lambda Labs|vLLM|Ollama|LM Studio|llama.cpp|TGI|Hugging Face|Fal.ai|Novita|DeepInfra|Hyperbolic|Nebius|CoreWeave|Vast.ai|Beam|Cortex|LocalAI|Jan|GPT4All|Msty|Open WebUI|LibreChat',
  },
  providers: {
    label: 'Model Providers',
    icon: '🧠',
    tools: 'OpenAI|Anthropic|Google DeepMind|Meta Llama|Mistral AI|Cohere|AI21|xAI|Alibaba Qwen|DeepSeek|Moonshot|Zhipu|01.AI|Baichuan|Stability AI|Black Forest Labs|Reka AI|Nous Research|Allen AI|EleutherAI|Amazon Bedrock|Azure OpenAI|Vertex AI|IBM watsonx|NVIDIA NIM|Databricks Mosaic|Snowflake Arctic|Writer Palmyra|Upstage|Sarvam AI',
  },
  vector_rag: {
    label: 'Vector & RAG',
    icon: '🗂️',
    tools: 'Pinecone|Weaviate|Qdrant|Chroma|Milvus|pgvector|LanceDB|Vespa|Marqo|Turbopuffer|Zilliz|Redis Vector|Elasticsearch|MongoDB Atlas Vector|Supabase Vector|Unstructured|LlamaParse|Reducto|Chunkr|Firecrawl|Jina AI|Voyage AI|Cohere Rerank|Ragie|Vectara|Contextual AI|Danswer|Onyx|Verba|RAGFlow|Cognita|R2R|Morphik',
  },
  eval: {
    label: 'Evals & Observability',
    icon: '🔬',
    tools: 'LangSmith|Langfuse|Weights & Biases Weave|Braintrust|Humanloop|PromptLayer|Helicone|Portkey|Arize Phoenix|WhyLabs|Galileo|Patronus|Ragas|DeepEval|Promptfoo|TruLens|Confident AI|Freeplay|Vellum Evals|Athina|Openlayer|Comet Opik|Literal AI|Laminar|HoneyHive',
  },
  sales: {
    label: 'Sales & Growth',
    icon: '📈',
    tools: 'Clay|Apollo|Regie|Lavender|Attention|Gong|Chorus|Clari|11x|Artisan|AiSDR|Unify|Common Room|HeyReach|Instantly|Smartlead|Amplemarket|Outreach AI|Salesloft AI|Nooks|Orum|Rox|Momentum|Substrata|Humantic|Warmly|Koala|Pocus',
  },
  marketing: {
    label: 'Marketing & Ads',
    icon: '📣',
    tools: 'AdCreative|Icon|Pencil|Omneky|Persado|Typeface|Jasper Brand|Copy.ai GTM|Ocoya|Predis|Postwise|Taplio|Hypefury|Buffer AI|Later AI|Hootsuite OwlyWriter|Vista Social|Publer|Metricool AI|Brandwatch AI|Sprout AI|Semrush AI|Jasper Art|Creatopy|Superside AI|AdLlama',
  },
  support: {
    label: 'Support & CX',
    icon: '🎧',
    tools: 'Intercom Fin|Zendesk AI|Ada|Forethought|Sierra|Decagon|Parloa|Cognigy|Voiceflow|Botpress|Rasa|Kustomer AI|Gladly|Freshdesk Freddy|Tidio Lyro|Crisp AI|Chatbase|CustomGPT|Stammer|Gorgias AI|Front AI|Help Scout AI|Yellow.ai|Haptik|Observe.ai|Level AI|Cresta',
  },
  voice_agents: {
    label: 'Voice Agents & Telephony',
    icon: '☎️',
    tools: 'Vapi|Retell AI|Bland|Synthflow|Air AI|PlayAI Agents|ElevenLabs Agents|OpenAI Realtime|Deepgram Voice Agent|Pipecat|LiveKit Agents|Daily Bots|Telnyx AI|Twilio ConversationRelay|Phonely|Regal|Goodcall|Slang.ai|Rosie|Sindarin',
  },
  legal: {
    label: 'Legal',
    icon: '⚖️',
    tools: 'Harvey|Legora|Spellbook|Luminance|Robin AI|EvenUp|Casetext CoCounsel|Ironclad|Lexion|Evisort|Klarity|LegalOn|DeepJudge|Marveri|Wordsmith|Genie AI|Darrow|Alexi|Clearbrief|Paxton',
  },
  finance: {
    label: 'Finance',
    icon: '💰',
    tools: 'Hebbia|Rogo|AlphaSense|Brightwave|Basis|Numeric|Tabs|Finster|Daloopa|Quartr AI|Bloomberg GPT|BlackRock Aladdin Copilot|Ramp Intelligence|Brex AI|Vic.ai|Klarity Finance|Trullion|Fintool|Arc|Perplexity Finance',
  },
  healthcare: {
    label: 'Healthcare',
    icon: '🩺',
    tools: 'Abridge|Nabla|Ambience|Freed|Heidi|OpenEvidence|Glass Health|Corti|Suki|DeepScribe|Augmedix|Nuance DAX|Hippocratic AI|K Health|Navina|Regard|Viz.ai|Aidoc|PathAI|Tempus One',
  },
  education: {
    label: 'Education',
    icon: '🎓',
    tools: 'Khanmigo|Duolingo Max|Quizlet Q-Chat|Photomath|Gauth|StudyFetch|Coursera Coach|Brisk|MagicSchool|Diffit|Curipod|Speechify Study|Socratic|Mathway|Symbolab|Wolfram Alpha|Numerade|Course Hero AI|Chegg AI|Perplexity Academic|Consensus Study|Scholarcy|Paper Digest',
  },
  security: {
    label: 'Security',
    icon: '🛡️',
    tools: 'Snyk DeepCode|Semgrep Assistant|GitHub Advanced Security|Socket|Endor Labs|Corgea|ZeroPath|Pixee|Mobb|Dryrun|XBOW|Horizon3|Pentera|Lakera|Protect AI|Robust Intelligence|HiddenLayer|Prompt Security|Zenity|Noma|Witness AI|CalypsoAI',
  },
  translation: {
    label: 'Translation & Localization',
    icon: '🌐',
    tools: 'DeepL|Google Translate|Lokalise AI|Crowdin AI|Smartling|Phrase|Weglot|Unbabel|Lengoo|Taia|Smartcat|Bureau Works|MotionPoint|Rask AI|HeyGen Translate|Papercup|Deepdub|Camb.ai|ElevenLabs Dubbing',
  },
  gaming: {
    label: 'Gaming & Worlds',
    icon: '🕹️',
    tools: 'Inworld|Convai|Charisma|Latitude AI Dungeon|Scenario|Layer AI|Leonardo Game Assets|Ludo.ai|Rosebud AI|Buildbox AI|Unity Muse|Unreal AI|Promethean|Anything World|Kaedim Game|Astrocade|Hidden Door|Genie 3|Decart|Odyssey',
  },
  robotics: {
    label: 'Robotics & Embodied',
    icon: '🤖',
    tools: 'Physical Intelligence|Skild AI|Covariant|Figure AI|1X|Agility|Dexterity|Ambi Robotics|NVIDIA GR00T|Google RT-X|LeRobot|Dyna Robotics|Cobot|Apptronik|Sanctuary AI',
  },
  science: {
    label: 'Science & Bio',
    icon: '🧬',
    tools: 'AlphaFold|Boltz|Chai Discovery|Isomorphic Labs|Cradle|Generate Biomedicines|Insilico|Recursion|EvolutionaryScale ESM|Ginkgo AI|Latchbio|Benchling AI|Deepmirror|Iambic|Terray|Enveda|FutureHouse|Elicit Science|Lila Sciences|Periodic Labs',
  },
};

// ---- derived ----------------------------------------------------------

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Flatten the seed into tool records. */
export function seedTools() {
  const out = [];
  for (const [catKey, cat] of Object.entries(CATEGORIES)) {
    for (const name of cat.tools.split('|')) {
      out.push({
        slug: slugify(name),
        name,
        category: catKey,
        categoryLabel: cat.label,
        icon: cat.icon,
        source: 'seed',
        // Providers we can actually authenticate against get a real adapter;
        // everything else runs through the generic adapter.
        addedAt: 0,
      });
    }
  }
  // De-dupe (a few tools legitimately appear in two categories).
  const seen = new Map();
  for (const t of out) {
    if (seen.has(t.slug)) {
      seen.get(t.slug).alsoIn ??= [];
      seen.get(t.slug).alsoIn.push(t.category);
    } else {
      seen.set(t.slug, t);
    }
  }
  return [...seen.values()];
}

export const SEED_COUNT = seedTools().length;
