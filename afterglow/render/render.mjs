#!/usr/bin/env node
// Offline renderer: drives headless Chromium (SwiftShader WebGL2) frame by frame and pipes raw
// RGBA frames over a local WebSocket into ffmpeg.
//
//   node render/render.mjs --stills 0,12.5,30            # PNG stills at those seconds → build/stills/
//   node render/render.mjs --from 0 --to 20 --out build/preview.mp4 --scale 0.5
//   node render/render.mjs --workers 3 --out build/video.mp4   # whole film, split across processes
//
// Times for --from/--to are seconds (frame = round(t*fps)); --frames a:b gives frames directly.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { WebSocketServer } = await import(path.join(ROOT, 'node_modules/ws/wrapper.mjs')).catch(() => import('ws'));
const pw = await import(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
const { chromium } = pw;

function parseArgs(argv) {
  const a = { shots: null, per: 3, resume: false, from: null, to: null, frames: null, out: null, stills: null, scale: 1, crf: 12, preset: 'medium', workers: 1, timeline: 'timeline.json', stillsDir: 'build/stills', quiet: false, sheet: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, ''); const v = argv[i + 1];
    if (['quiet', 'sheet', 'resume'].includes(k)) { a[k] = true; continue; }
    if (k === 'from' || k === 'to' || k === 'scale' || k === 'crf' || k === 'workers' || k === 'per') a[k] = +v;
    else if (k === 'stills-dir') a.stillsDir = v;
    else a[k] = v;
    i++;
  }
  return a;
}
const args = parseArgs(process.argv);
const tl = JSON.parse(fs.readFileSync(path.resolve(ROOT, args.timeline), 'utf8'));
const FPS = tl.fps || 24;
const W = Math.round((tl.width || 1920) * args.scale / 2) * 2, H = Math.round((tl.height || 1080) * args.scale / 2) * 2;
const TOTAL = Math.round(tl.duration * FPS);
// --shots S01,S02 (or all) --per N: N evenly spaced stills inside each shot (avoiding the exact cut frames)
if (args.shots) {
  const ids = args.shots === 'all' ? null : new Set(args.shots.split(','));
  const times = [];
  for (const s of tl.shots) if (!ids || ids.has(s.id)) for (let k = 0; k < args.per; k++) times.push(s.start + (s.end - s.start) * (k + 0.5) / args.per);
  args.stills = times.map(t => t.toFixed(3)).join(',');
  if (!args.sheet) args.sheet = true;
}

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.ttf': 'font/ttf', '.otf': 'font/otf', '.png': 'image/png', '.css': 'text/css', '.txt': 'text/plain' };
function startServer() {
  return new Promise(res => {
    const srv = http.createServer((q, s) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      let f = path.join(ROOT, u === '/' ? '/web/index.html' : u);
      if (!f.startsWith(ROOT)) { s.statusCode = 403; return s.end(); }
      if (u === '/timeline.json') f = path.resolve(ROOT, args.timeline);
      fs.stat(f, (err, st) => {
        if (err || !st.isFile()) { s.statusCode = 404; return s.end('not found'); }
        s.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
        s.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(f).pipe(s);
      });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

function ffmpegVideo(out) {
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', args.preset, '-crf', String(args.crf), '-tune', 'film', '-x264-params', 'keyint=48:min-keyint=24',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  return p;
}
function ffmpegPng(buf, out) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip', '-frames:v', '1', out]);
    p.on('exit', c => (c === 0 ? res() : rej(new Error('ffmpeg png failed'))));
    p.stdin.end(Buffer.from(buf));
  });
}

async function launch(serverPort, wsPort) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog',
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
      '--js-flags=--max-old-space-size=4096'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || /BOOT|shot module|WARN/i.test(t)) if (!/GPU stall|GL Driver/.test(t)) console.error('[page]', t); });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(`http://127.0.0.1:${serverPort}/web/index.html?w=${W}&h=${H}${wsPort ? `&ws=${wsPort}` : ''}`);
  await page.waitForFunction('window.AG_READY || window.AG_ERROR', null, { timeout: 120000 });
  const err = await page.evaluate('window.AG_ERROR');
  if (err) throw new Error(err);
  return { browser, page };
}

// Global render semaphore: at most AG_SLOTS (default 3) Chromium renderers at once across all
// processes (several agents iterate in parallel; each browser needs 1–2 GB). AG_NOLOCK=1 bypasses.
async function acquireSlot() {
  if (process.env.AG_NOLOCK) return;
  const n = +(process.env.AG_SLOTS || 3), dir = path.join(ROOT, 'build', 'locks');
  fs.mkdirSync(dir, { recursive: true });
  let waited = 0;
  for (;;) {
    for (let i = 0; i < n; i++) {
      const f = path.join(dir, `slot${i}`);
      try {
        const fd = fs.openSync(f, 'wx'); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
        process.on('exit', () => { try { fs.unlinkSync(f); } catch {} });
        for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));
        if (waited) console.log(`(render slot ${i} acquired after ${waited}s)`);
        return;
      } catch {
        try { const pid = +fs.readFileSync(f, 'utf8'); if (pid) process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH' || e.code === 'ENOENT') { try { fs.unlinkSync(f); } catch {} } }
      }
    }
    if (waited % 30 === 0) console.log(`(waiting for a render slot… ${waited}s; another agent is rendering)`);
    await new Promise(r => setTimeout(r, 2000)); waited += 2;
  }
}

async function runSingle() {
  await acquireSlot();
  const srv = await startServer();
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: 1 << 30 });
  await new Promise(r => wss.on('listening', r));
  let sock = null; const queue = []; let waiter = null;
  wss.on('connection', s => { sock = s; s.on('message', d => { queue.push(d); if (waiter) { const w = waiter; waiter = null; w(); } }); });
  const nextFrame = () => new Promise(r => { if (queue.length) return r(queue.shift()); waiter = () => r(queue.shift()); });
  const { browser, page } = await launch(srv.address().port, wss.address().port);
  const log = (...m) => { if (!args.quiet) console.log(...m); };
  try {
    if (args.stills) {
      fs.mkdirSync(path.resolve(ROOT, args.stillsDir), { recursive: true });
      const times = args.stills.split(',').map(Number);
      const written = [];
      for (const t of times) {
        const fr = Math.min(TOTAL - 1, Math.round(t * FPS));
        await page.evaluate(([a, b]) => window.AG.prepare(a, b), [t, t]);
        const info = await page.evaluate(f => window.AG.renderFrame(f), fr);
        const buf = await nextFrame();
        const out = path.resolve(ROOT, args.stillsDir, `f${String(fr).padStart(5, '0')}_${info.shot}.png`);
        await ffmpegPng(buf, out);
        written.push(out);
        log(`still t=${t.toFixed(2)} frame=${fr} shot=${info.shot} ${info.ms}ms → ${path.relative(ROOT, out)}`);
      }
      if (args.sheet && written.length > 1) {
        const cols = Math.min(4, written.length), rows = Math.ceil(written.length / cols);
        const sheet = path.resolve(ROOT, args.stillsDir, 'sheet.jpg');
        const inputs = written.flatMap(f => ['-i', f]);
        const filt = written.map((_, i) => `[${i}:v]scale=480:-2[v${i}]`).join(';') + ';' + written.map((_, i) => `[v${i}]`).join('') + `xstack=inputs=${written.length}:layout=` +
          written.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, () => 'h0').join('+') : '0'}`).join('|') + ':fill=black';
        await new Promise(r => spawn('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', written.length > 1 ? filt : 'null', '-frames:v', '1', sheet], { stdio: 'inherit' }).on('exit', r));
        log('sheet →', path.relative(ROOT, sheet));
      }
      return;
    }
    let f0, f1;
    if (args.frames) [f0, f1] = args.frames.split(':').map(Number);
    else { f0 = Math.round((args.from ?? 0) * FPS); f1 = Math.round((args.to ?? tl.duration) * FPS); }
    f1 = Math.min(f1, TOTAL);
    const out = path.resolve(ROOT, args.out || 'build/out.mp4');
    const ff = ffmpegVideo(out);
    const ffDone = new Promise(r => ff.on('exit', r));
    await page.evaluate(([a, b]) => window.AG.prepare(a, b), [f0 / FPS, f0 / FPS]);
    const T0 = Date.now(); let lastShot = null;
    // pipeline: request frame f+1 while frame f is being written
    for (let f = f0; f < f1; f++) {
      const info = await page.evaluate(fr => window.AG.renderFrame(fr), f);
      const buf = await nextFrame();
      if (!ff.stdin.write(Buffer.from(buf))) await new Promise(r => ff.stdin.once('drain', r));
      const done = f - f0 + 1, el = (Date.now() - T0) / 1000, eta = el / done * (f1 - f0 - done);
      if (info.shot !== lastShot || done % 24 === 0 || f === f1 - 1) {
        log(`[${path.basename(out)}] frame ${f}/${f1} (${(100 * done / (f1 - f0)).toFixed(1)}%) shot=${info.shot} ${info.ms}ms  avg ${(el / done).toFixed(2)}s/f  eta ${Math.round(eta)}s`);
        lastShot = info.shot;
      }
    }
    ff.stdin.end();
    await ffDone;
    log(`done → ${path.relative(ROOT, out)} in ${((Date.now() - T0) / 1000).toFixed(0)}s`);
  } finally {
    await browser.close(); srv.close(); wss.close();
  }
}

async function runParallel() {
  let f0 = Math.round((args.from ?? 0) * FPS), f1 = Math.min(TOTAL, Math.round((args.to ?? tl.duration) * FPS));
  const n = args.workers, out = path.resolve(ROOT, args.out || 'build/video.mp4');
  const segDir = path.resolve(ROOT, 'build/segments');
  if (!args.resume) fs.rmSync(segDir, { recursive: true, force: true });
  fs.mkdirSync(segDir, { recursive: true });
  // split on frame counts; interleave chunks so that heavy sequences spread across workers
  const chunk = 240; const chunks = [];
  for (let a = f0; a < f1; a += chunk) chunks.push([a, Math.min(f1, a + chunk)]);
  const self = fileURLToPath(import.meta.url);
  let next = 0; const T0 = Date.now();
  const runWorker = async w => {
    while (next < chunks.length) {
      const i = next++; const [a, b] = chunks[i];
      const seg = path.join(segDir, `seg_${String(i).padStart(4, '0')}.mp4`);
      if (fs.existsSync(seg) && fs.existsSync(seg + '.ok')) continue;
      await new Promise((res, rej) => {
        const p = spawn(process.execPath, [self, '--frames', `${a}:${b}`, '--out', seg, '--scale', String(args.scale), '--crf', String(args.crf), '--preset', args.preset, '--timeline', args.timeline, '--quiet'], { stdio: 'inherit' });
        p.on('exit', c => (c === 0 ? res() : rej(new Error(`worker chunk ${i} failed`))));
      });
      fs.writeFileSync(seg + '.ok', '');
      const el = (Date.now() - T0) / 1000;
      console.log(`chunk ${i + 1}/${chunks.length} [${a}-${b}) done by worker ${w}; elapsed ${Math.round(el)}s`);
    }
  };
  await Promise.all(Array.from({ length: n }, (_, w) => runWorker(w)));
  const list = path.join(segDir, 'list.txt');
  fs.writeFileSync(list, chunks.map((_, i) => `file 'seg_${String(i).padStart(4, '0')}.mp4'`).join('\n'));
  await new Promise(r => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' }).on('exit', r));
  console.log(`film video → ${path.relative(ROOT, out)} (${((Date.now() - T0) / 60000).toFixed(1)} min)`);
}

if (args.workers > 1 && !args.stills) await runParallel();
else await runSingle();
process.exit(0);
