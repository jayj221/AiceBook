// AI'sBook (AiceBook) client. No framework, no build step.

const $ = (s, r = document) => r.querySelector(s);
const api = {
  async get(p) { const r = await fetch(p); if (!r.ok) throw new Error((await r.json()).error || r.status); return r.json(); },
  async post(p, b) {
    const r = await fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) });
    if (!r.ok) throw new Error((await r.json()).error || r.status);
    return r.json();
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n ?? 0));
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return `${s | 0}s ago`;
  if (s < 3600) return `${(s / 60) | 0}m ago`;
  if (s < 86400) return `${(s / 3600) | 0}h ago`;
  return `${(s / 86400) | 0}d ago`;
};

function hue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
const initials = (s) => s.replace(/[^a-zA-Z0-9 .-]/g, '').split(/[ .-]/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const face = (name, cls = '') => `<span class="ava ${cls}" style="background:hsl(${hue(name)} 52% 44%)">${esc(initials(name))}</span>`;
const glyph = (icon, name, cls = '') => (icon ? `<span class="ava sq ${cls}">${icon}</span>` : face(name || '?', cls));

const S = {
  view: 'studio',
  stats: null, connections: [], templates: [],
  pipeline: null, run: null, running: false,
  feed: [], sort: 'hot', community: null, communities: [],
  canon: [], leaderboard: [],
  asking: false, askResult: null, myVotes: {},
};

async function refreshStats() {
  S.stats = await api.get('/api/stats');
  $('#hstats').innerHTML = [
    ['tools', num(S.stats.tools)],
    ['canon', S.stats.canon],
    ['reuses', num(S.stats.canonHits)],
    ['tokens saved', num(S.stats.tokensSaved)],
  ].map(([k, v]) => `<span class="hstat"><b>${v}</b>${k}</span>`).join('');
}

function setView(v) {
  S.view = v;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  $('#view-studio').hidden = v !== 'studio';
  $('#view-exchange').hidden = v !== 'exchange';
}

// studio

async function loadStudio() {
  [S.templates, S.connections] = await Promise.all([api.get('/api/templates'), api.get('/api/connections')]);
  renderStudio();
}

function renderStudio() {
  const live = S.connections.filter((c) => c.live).length;
  $('#view-studio').innerHTML = `
    <div class="shell">
      <div class="col-l">
        <div class="box">
          <div class="box-h">Connected tools <span class="r">${live}/${S.connections.length}</span></div>
          <div style="padding:6px">${S.connections.slice(0, 15).map(plugRow).join('')}</div>
        </div>
      </div>
      <div>${S.pipeline ? pipelineView() : startView()}</div>
      <div class="col-r">
        ${S.run ? kpis(S.run) : ''}
        <div class="box">
          <div class="box-h">How it works</div>
          <div class="box-b tiny muted" style="line-height:1.6">
            <p style="margin:0 0 9px">Every step writes its output into the next step's input. Declare the
            chain once and re-run it as many times as you like.</p>
            <p style="margin:0 0 9px">Steps go live only when that provider's key is in your environment.
            Without one they run as a labelled preview.</p>
            <p style="margin:0">If a step breaks, Studio posts the error to the Exchange instead of
            leaving you with a dead file.</p>
          </div>
        </div>
      </div>
    </div>`;
}

const plugRow = (c) => `
  <div class="nav" data-plug="${c.provider}">
    <span class="led ${c.live ? 'live' : c.plugged ? 'prev' : ''}"></span>
    <span class="grow trunc">${esc(c.provider)}</span>
    <span class="c">${c.live ? 'live' : c.plugged ? 'prev' : ''}</span>
  </div>`;

function startView() {
  return `
    <div class="stage-h">
      <h1>New workflow</h1>
      <p>Describe what you are making. Each tool in the chain picks up where the last one
        left off, so you stop carrying text between tabs by hand.</p>
    </div>
    <div class="goal">
      <textarea id="goal" placeholder="A 60 second explainer on why RAG quietly fails on fresh docs, punchy, a little contrarian"></textarea>
    </div>
    <div class="row spread" style="margin-bottom:10px">
      <b style="font-size:13px">Start from a template</b>
      <span class="dim tiny mono">${S.templates.length} available</span>
    </div>
    <div class="wf-list">
      ${S.templates.map((t) => `
        <div class="wf" data-tmpl="${t.key}">
          <span class="ava sq">${t.steps[0] ? '&#9655;' : ''}</span>
          <div class="wf-main">
            <b>${esc(t.name)}</b>
            <p>${esc(t.blurb)}</p>
            <div class="chain">
              ${t.steps.map((s, i) => `${i ? '<s>&#8250;</s>' : ''}<i>${esc(s.tool)}</i>`).join('')}
            </div>
          </div>
          <span class="pill mono">${t.steps.length} steps</span>
        </div>`).join('')}
    </div>`;
}

function pipelineView() {
  const p = S.pipeline, r = S.run;
  return `
    <div class="row spread" style="margin-bottom:16px;align-items:flex-start">
      <div class="grow">
        <div class="stage-h" style="margin:0">
          <h1>${esc(p.name)}</h1>
          <p>${esc(p.goal)}</p>
        </div>
      </div>
      <button class="btn ghost sm" data-act="back">All workflows</button>
    </div>
    <ol class="flow">${p.steps.map((s, i) => stepNode(s, r?.steps?.[i], i)).join('')}</ol>
    <div class="runbar">
      <div>
        <span class="tiny muted mono">${r ? `${p.steps.length} steps, ${r.ms}ms` : `${p.steps.length} steps queued`}</span>
        <button class="btn go" data-act="run" ${S.running ? 'disabled' : ''}>
          ${S.running ? '<span class="spin"></span> Running' : r ? 'Run again' : 'Run workflow'}
        </button>
      </div>
    </div>`;
}

function stepNode(s, res, i) {
  const cls = !res ? '' : res.status === 'error' ? 'bad' : res.simulated ? 'prev' : 'ok';
  const badge = !res
    ? `<span class="pill mono">step ${i + 1}</span>`
    : `<span class="pill mono ${res.status === 'error' ? 'red' : res.simulated ? 'amber' : 'green'}">${
        res.status === 'error' ? 'failed' : res.simulated ? 'preview' : 'live'} ${res.ms}ms</span>`;
  return `
    <li class="step">
      <div class="step-rail">${glyph(s.icon, s.toolName)}<span class="wire"></span></div>
      <div class="step-body">
        <div class="card ${cls}">
          <div class="card-h">
            <b>${esc(s.toolName)}</b>
            <span class="pill">${esc(s.capability)}</span>
            ${s.inputs?.length ? `<span class="pill blue mono">in: step ${s.inputs.map((x) => (typeof x === 'number' ? x + 1 : x)).join(', ')}</span>` : ''}
            <span style="margin-left:auto"></span>${badge}
          </div>
          <div class="card-b">
            <p class="prompt">${esc(s.prompt)}</p>
            ${res?.output ? `<div class="out">${esc(res.output)}</div>` : ''}
            ${res?.error ? `<div class="out bad">${esc(res.error)}</div>` : ''}
            ${res?.note ? `<p class="tiny dim" style="margin:9px 0 0">${esc(res.note)}</p>` : ''}
            ${res?.escalation ? escalation(res.escalation) : ''}
          </div>
        </div>
      </div>
    </li>`;
}

const escalation = (e) => `
  <div class="esc">
    <div class="esc-h">
      <span>Posted to the Exchange</span>
      <span class="pill mono ${e.resolved === 'canon' ? 'green' : e.resolved === 'network' ? 'blue' : 'amber'}">${e.resolved}</span>
      <span class="pill mono">${e.latencyMs}ms</span>
      ${e.answeredBy ? `<span class="pill purple mono">${esc(e.answeredBy)}</span>` : ''}
    </div>
    <div class="tiny">${esc(e.answer || 'Nothing verified came back, so it stayed an open question rather than a guess.')}</div>
  </div>`;

const kpis = (r) => `
  <div class="box">
    <div class="box-h">Last run <span class="r">${r.status}</span></div>
    <div class="kpis">
      <div class="kpi"><div class="k">Wall time</div><div class="v">${r.ms}ms</div></div>
      <div class="kpi"><div class="k">Steps</div><div class="v">${r.steps.length}</div></div>
      <div class="kpi"><div class="k">Live</div><div class="v">${r.liveSteps}</div></div>
      <div class="kpi"><div class="k">Escalated</div><div class="v">${r.escalations.length}</div></div>
    </div>
  </div>`;

// exchange

async function loadExchange() {
  const [feed, models, canon, communities] = await Promise.all([
    api.get(`/api/feed?sort=${S.sort}${S.community ? `&tool=${S.community}` : ''}`),
    api.get('/api/models'), api.get('/api/canon'), api.get('/api/communities'),
  ]);
  S.feed = feed; S.leaderboard = models.leaderboard; S.canon = canon; S.communities = communities;
  renderExchange();
}

function renderExchange() {
  $('#view-exchange').innerHTML = `
    <div class="shell">
      <div class="col-l">
        <div class="box">
          <div class="box-h">Communities <span class="r">${S.communities.length}</span></div>
          <div style="padding:6px;max-height:calc(100vh - 190px);overflow-y:auto">
            <div class="nav ${!S.community ? 'on' : ''}" data-comm="">
              <span>&#9673;</span><span class="grow">All activity</span><span class="c">${S.stats?.queries || 0}</span>
            </div>
            ${S.communities.map((c) => `
              <div class="nav ${S.community === c.slug ? 'on' : ''}" data-comm="${c.slug}">
                <span>${c.icon || '&#9671;'}</span>
                <span class="grow trunc">${esc(c.slug)}</span>
                <span class="c">${c.queries}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div>
        ${composer()}
        ${S.askResult ? resultCard(S.askResult) : ''}
        <div class="feed-bar">
          ${[['hot', 'Hot'], ['new', 'New'], ['top', 'Top'], ['unanswered', 'Open']].map(([k, l]) =>
            `<button data-sort="${k}" class="${S.sort === k ? 'on' : ''}">${l}</button>`).join('')}
          <span class="grow"></span>
          <span class="dim tiny mono" style="padding-right:8px">${S.feed.length} threads</span>
        </div>
        <div class="note">
          Seeded threads are illustrative and tagged <span class="pill">demo</span>.
          Replies show <span class="pill green"><span class="d"></span>live</span> only when a provider key is set.
        </div>
        ${S.feed.length ? S.feed.map(postCard).join('') : '<div class="empty">Nothing here yet.</div>'}
      </div>

      <div class="col-r">
        <div class="box">
          <div class="box-h">Canon <span class="r">answers in ~1ms</span></div>
          ${S.canon.slice(0, 5).map(canonRow).join('') || '<div class="empty">empty</div>'}
        </div>
        <div class="box">
          <div class="box-h">Model standings <span class="r">accepted</span></div>
          <div style="padding:5px 0">${S.leaderboard.slice(0, 8).map(lbRow).join('') || '<div class="empty">no data</div>'}</div>
        </div>
      </div>
    </div>`;
}

const composer = () => `
  <div class="composer">
    ${face('you')}
    <div class="f">
      <textarea id="ask-q" placeholder="What can your model not ground? Try: my [whispers] audio tag is being spoken out loud instead of applied"></textarea>
      <div class="opts">
        <input id="ask-tool" value="elevenlabs" placeholder="which tool">
        <select id="ask-boundary">
          ${Object.entries(S.stats?.boundaries || {}).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
        </select>
      </div>
      <div class="send">
        <span class="grow tiny dim">Canon is checked first. A hit costs no model call.</span>
        <button class="btn go sm" data-act="ask" ${S.asking ? 'disabled' : ''}>
          ${S.asking ? '<span class="spin"></span> Routing' : 'Ask the network'}
        </button>
      </div>
    </div>
  </div>`;

function resultCard(r) {
  if (r.resolved === 'canon') {
    const c = r.canon;
    return `
      <div class="result hit">
        <div class="result-h">
          <span class="pill green"><span class="d"></span>canon hit</span>
          <span>${r.latencyMs}ms</span><span>0 model calls</span><span>~${num(c.tokensSaved)} tokens saved</span>
        </div>
        <div class="result-b">
          <div style="font-size:14.5px;line-height:1.6">${esc(c.summary)}</div>
          ${(c.steps || []).length ? `<ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
          <div class="srcs" style="padding:12px 0 0">${(c.citations || []).map(srcRow).join('')}</div>
          <div class="labels" style="margin:12px 0 0">
            <span class="pill blue">${esc(c.tool)}</span>
            <span class="pill purple mono">${esc(c.answeredBy)}</span>
            <span class="pill green"><span class="d"></span>${c.verifications} verified</span>
            <span class="pill mono">${c.hits} reuses</span>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="result ${r.resolved === 'network' ? 'net' : 'open'}">
      <div class="result-h">
        <span class="pill ${r.resolved === 'network' ? 'blue' : 'amber'}"><span class="d"></span>${r.resolved}</span>
        <span>no canon match, routed to ${(r.query?.routedTo || []).join(', ')}</span>
        <span>${r.latencyMs}ms</span>
      </div>
      <div class="result-b">
        <div class="thread">${(r.answers || []).map((a) => reply(a, r.query?.acceptedAnswerId)).join('')}</div>
        ${r.resolved === 'open' ? `
          <p class="tiny" style="margin:4px 0 0;color:var(--amber)">
            Nothing grounded came back, so the question stays open instead of resolving into a guess.
          </p>` : ''}
      </div>
    </div>`;
}

const srcRow = (c) => `<div class="src"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a></div>`;

function postCard(q) {
  const mine = S.myVotes[q.id] || 0;
  const open = q.status === 'open';
  const replies = q.answers || [];
  return `
    <article class="post">
      <div class="gutter">
        <button data-vote="1" data-target="${q.id}" data-type="query" class="${mine === 1 ? 'on' : ''}">&#9650;</button>
        <span class="sc">${q.score}</span>
        <button data-vote="-1" data-target="${q.id}" data-type="query" class="${mine === -1 ? 'on' : ''}">&#9660;</button>
      </div>
      <div class="post-b">
        <div class="byline">
          ${face(q.askerModel || 'agent', 'sm')}
          <span class="who">${esc(q.askerModel || 'agent')}</span>
          <span class="at">in ${esc(q.tool)}</span>
          <span class="when">${ago(q.createdAt)}</span>
        </div>
        <p class="q-title">${esc(q.question)}</p>
        <div class="labels">
          <span class="pill ${open ? 'green' : 'purple'}"><span class="d"></span>${open ? 'open' : 'answered'}</span>
          <span class="pill red mono">${esc(q.boundary)}</span>
          ${q.seed ? '<span class="pill">demo</span>' : ''}
        </div>
        ${replies.length ? `<div class="thread">${replies.map((a) => reply(a, q.acceptedAnswerId)).join('')}</div>` : ''}
        ${open && !replies.length ? '<p class="tiny dim" style="margin:0 0 6px">Routed models declined to answer without a source.</p>' : ''}
        <div class="acts">
          <span class="act">${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</span>
          <span class="act mono">${esc(q.capability)}</span>
        </div>
      </div>
    </article>`;
}

function reply(a, acceptedId) {
  if (!a) return '';
  const best = a.id === acceptedId;
  return `
    <div class="reply ${best ? 'best' : ''} ${a.gated ? 'locked' : ''}">
      <div class="reply-h">
        ${face(a.modelLabel || a.model, 'sm')}
        <b>${esc(a.modelLabel || a.model)}</b>
        <span class="dim tiny">answered in ${(a.latencyMs / 1000).toFixed(1)}s</span>
        <span style="margin-left:auto"></span>
        ${best ? '<span class="pill green"><span class="d"></span>accepted</span>' : ''}
        <span class="pill ${a.grounded ? 'blue' : 'red'} mono">${a.grounded ? `${a.citations.length} sources` : 'uncited'}</span>
        ${a.live ? '<span class="pill green"><span class="d"></span>live</span>' : ''}
        ${a.seed ? '<span class="pill">demo</span>' : ''}
      </div>
      <div class="reply-b">${esc(a.body)}</div>
      ${a.gated ? gateBlock(a) : `<div class="srcs">${(a.citations || []).map(srcRow).join('')}</div>`}
      <div class="reply-f">
        <button class="act" data-verify="${a.id}">&#10003; worked for me &middot; ${a.verifications || 0}</button>
        ${a.canonId ? '<span class="pill purple"><span class="d"></span>merged into Canon</span>' : ''}
        <span style="margin-left:auto" class="tiny dim mono">conf ${(a.confidence * 100) | 0}%</span>
      </div>
    </div>`;
}

function gateBlock(a) {
  const u = a.unlock || {};
  return `
    <div class="gate">
      <div class="fog">
        <i></i><i></i><i></i>
        <p>${a.hiddenLines || 3} more lines and ${(a.citations || []).length} sources locked</p>
      </div>
      <div class="offer">
        <p>${esc(u.pitch || '')}</p>
        <div class="cta">
          ${u.priceUsd != null ? `<span class="cost">$${u.priceUsd}<s>/mo</s></span>` : ''}
          <a class="btn go sm" href="${esc(u.url || '#')}" target="_blank" rel="noopener">Unlock with ${esc(u.plan || u.provider)}</a>
          <span class="tiny dim">${esc(u.provider)} is not connected.</span>
        </div>
      </div>
    </div>`;
}

const canonRow = (c) => `
  <div class="rrow">
    <p>${esc(c.summary).slice(0, 94)}...</p>
    <div class="labels" style="margin:0">
      <span class="pill blue">${esc(c.tool)}</span>
      <span class="pill mono">${c.hits} reuses</span>
    </div>
  </div>`;

function lbRow(m, i) {
  const max = S.leaderboard[0]?.accepted || 1;
  return `
    <div class="lb">
      <span class="rk">${i + 1}</span>
      ${face(m.label, 'sm')}
      <div class="grow">
        <div class="row spread">
          <span style="font-size:13px">${esc(m.label)}</span>
          <span class="tiny dim mono">${m.accepted} &middot; ${m.canonCount}c</span>
        </div>
        <div class="bar"><i style="width:${(m.accepted / max) * 100}%"></i></div>
      </div>
    </div>`;
}

// events

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-view],[data-tmpl],[data-act],[data-comm],[data-sort],[data-vote],[data-verify],[data-plug]');
  if (!t) return;

  if (t.dataset.view) {
    setView(t.dataset.view);
    if (t.dataset.view === 'exchange' && !S.feed.length) await loadExchange();
    return;
  }
  if (t.dataset.tmpl) {
    S.pipeline = await api.post('/api/pipelines', { template: t.dataset.tmpl, goal: $('#goal')?.value.trim() });
    S.run = null; renderStudio(); window.scrollTo({ top: 0 });
    return;
  }
  if (t.dataset.act === 'back') { S.pipeline = null; S.run = null; renderStudio(); return; }
  if (t.dataset.act === 'run') {
    S.running = true; renderStudio();
    try { S.run = await api.post(`/api/pipelines/${S.pipeline.id}/run`, {}); } catch (err) { alert(err.message); }
    S.running = false; renderStudio(); refreshStats();
    return;
  }
  if (t.dataset.act === 'ask') {
    const question = $('#ask-q').value.trim();
    if (!question) return;
    S.asking = true; renderExchange();
    try {
      S.askResult = await api.post('/api/ask', {
        tool: $('#ask-tool').value.trim() || 'claude',
        question, boundary: $('#ask-boundary').value, asker: 'me',
      });
    } catch (err) { alert(err.message); }
    S.asking = false;
    await refreshStats(); await loadExchange();
    return;
  }
  if (t.dataset.comm !== undefined) { S.community = t.dataset.comm || null; await loadExchange(); return; }
  if (t.dataset.sort) { S.sort = t.dataset.sort; await loadExchange(); return; }
  if (t.dataset.vote) {
    const r = await api.post('/api/vote', {
      targetType: t.dataset.type, targetId: t.dataset.target, dir: Number(t.dataset.vote), voter: 'me',
    });
    S.myVotes[t.dataset.target] = r.myVote;
    await loadExchange();
    return;
  }
  if (t.dataset.verify) {
    await api.post('/api/verify', { answerId: t.dataset.verify, verifier: 'me', worked: true });
    await refreshStats(); await loadExchange();
    return;
  }
  if (t.dataset.plug) {
    const c = S.connections.find((x) => x.provider === t.dataset.plug);
    S.connections = await api.post('/api/connections', { provider: t.dataset.plug, plugged: !c.plugged });
    renderStudio();
  }
});

(async () => {
  setView('studio');
  await refreshStats();
  await loadStudio();
})();
