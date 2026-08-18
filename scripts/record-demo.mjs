// Records docs/demo.gif by driving the running app in headless Chrome.
// Needs ffmpeg on PATH and Chrome installed.
//
//   node server.js &
//   node scripts/record-demo.mjs

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FRAMES = join(ROOT, '.frames');
const OUT = join(ROOT, 'docs', 'demo.gif');
const APP = process.env.APP_URL || 'http://localhost:4173';
const PORT = 9222;
const FPS = 8;
const TICK = 1000 / FPS;
const WIDTH = 1280;
const HEIGHT = 800;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
].find((p) => {
  try {
    execFileSync('test', ['-x', p]);
    return true;
  } catch {
    return false;
  }
});

if (!CHROME) {
  console.error('no chrome binary found');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.seq = 0;
    this.pending = new Map();
    this.ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      const resolve = this.pending.get(msg.id);
      if (!resolve) return;
      this.pending.delete(msg.id);
      resolve(msg.result);
    });
  }

  ready() {
    return new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', rej, { once: true });
    });
  }

  send(method, params = {}) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => this.pending.set(id, resolve));
  }

  eval(expression) {
    return this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  }
}

// Each beat fires once at its timestamp. Frames roll independently.
const script = [
  { at: 500, js: `document.querySelector('#goal').focus()` },
  ...'why RAG quietly fails on fresh docs'.split('').map((ch, i) => ({
    at: 800 + i * 52,
    js: `(()=>{const g=document.querySelector('#goal'); g.value += ${JSON.stringify(ch)};})()`,
  })),
  { at: 3000, js: `document.querySelector('[data-tmpl="ai-video"]').click()` },
  { at: 4100, js: `document.querySelector('[data-act="run"]').click()` },
  { at: 6000, js: `window.scrollTo({top:380,behavior:'smooth'})` },
  { at: 7700, js: `window.scrollTo({top:900,behavior:'smooth'})` },
  { at: 9300, js: `window.scrollTo({top:0}); document.querySelector('[data-view="exchange"]').click()` },
  { at: 11300, js: `document.querySelector('#ask-q').value = "my [whispers] audio tag is being spoken out loud instead of applied"` },
  { at: 12200, js: `document.querySelector('[data-act="ask"]').click()` },
  { at: 14200, js: `window.scrollTo({top:430,behavior:'smooth'})` },
  { at: 15800, js: `window.scrollTo({top:900,behavior:'smooth'})` },
];

const DURATION = 18500;

async function main() {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });
  mkdirSync(join(ROOT, 'docs'), { recursive: true });

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    'about:blank',
  ]);

  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error('chrome never came up');

  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.ready();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send('Page.navigate', { url: APP });
  await sleep(2500);

  const queue = [...script];
  let frame = 0;
  const started = Date.now();

  while (Date.now() - started < DURATION) {
    const t = Date.now() - started;
    while (queue.length && queue[0].at <= t) {
      await cdp.eval(queue.shift().js);
    }
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(FRAMES, `f${String(frame++).padStart(4, '0')}.png`), Buffer.from(shot.data, 'base64'));
    const drift = TICK - ((Date.now() - started) % TICK);
    await sleep(drift);
  }

  chrome.kill();
  console.log(`captured ${frame} frames`);

  const filters = 'fps=8,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=3';
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%04d.png'), '-lavfi', filters, '-loop', '0', OUT], {
    stdio: 'inherit',
  });

  rmSync(FRAMES, { recursive: true, force: true });
  console.log(`wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
