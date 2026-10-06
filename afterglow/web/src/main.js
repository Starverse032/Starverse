// Boot: load fonts + timeline, build the engine, expose window.AG for the offline renderer.
// URL params: w, h (render size), ws (frame sink port), tl (timeline url), play=1 (realtime preview)
import { Engine } from './engine.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1920), H = +(q.get('h') || 1080);

async function loadFonts() {
  const specs = [
    '300 40px "Noto Serif CJK SC"', '400 40px "Noto Serif CJK SC"', '200 40px "Noto Serif CJK SC"',
    '300 40px "Noto Sans CJK SC"', '400 40px "Noto Sans CJK SC"', '400 40px "Noto Sans Mono CJK SC"',
    '400 40px "Cormorant Garamond"', '500 40px "Cormorant Garamond"', 'italic 400 40px "Cormorant Garamond"',
    '300 40px "IBM Plex Mono"', '400 40px "IBM Plex Mono"', '500 40px "IBM Plex Mono"',
    '300 40px "Noto Serif Display VF"', '200 40px "Noto Serif CJK SC"', '500 40px "Inter"', '300 40px "Inter"', 'italic 300 40px "Inter"',
    '400 40px "Noto Sans Mono CJK SC"', '600 40px "Noto Serif CJK SC"', '300 40px "Noto Sans CJK SC"',
  ];
  await Promise.all(specs.map(s => document.fonts.load(s, '余光 AFTERGLOW 0123')));
}

async function boot() {
  await loadFonts();
  const tl = await (await fetch(q.get('tl') || '../timeline.json', { cache: 'no-store' })).json();
  const engine = new Engine(tl, { W, H, canvas: document.getElementById('c') });
  const gl = engine.renderer.getContext();
  const bufs = [new Uint8Array(W * H * 4), new Uint8Array(W * H * 4)];
  let which = 0;
  let ws = null;
  if (q.get('ws')) {
    ws = new WebSocket(`ws://127.0.0.1:${q.get('ws')}`);
    ws.binaryType = 'arraybuffer';
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  }
  const drain = () => new Promise(res => { const chk = () => (ws.bufferedAmount < W * H * 4 ? res() : setTimeout(chk, 1)); chk(); });
  window.AG = {
    W, H, fps: engine.fps, duration: engine.duration, frameCount: engine.frameCount, engine,
    shots: tl.shots.map(s => ({ id: s.id, start: s.start, end: s.end, module: s.module })),
    async renderFrame(frame, send = true) {
      const t0 = performance.now();
      const info = await engine.renderFrame(frame);
      const buf = bufs[which]; which ^= 1;
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const t1 = performance.now();
      if (send && ws) { await drain(); ws.send(buf); }
      return { ...info, ms: Math.round(t1 - t0) };
    },
    // warm up modules used in a time range (so init cost is not attributed to a frame)
    async prepare(t0, t1) {
      const names = new Set(tl.shots.filter(s => s.end > t0 - 3 && s.start < t1 + 3).map(s => s.module));
      for (const n of names) await engine.module(n);
      return [...names];
    },
  };
  if (q.get('play')) {
    let start = performance.now() - (+(q.get('t') || 0)) * 1000;
    const loop = async () => { const t = (performance.now() - start) / 1000; await engine.renderFrame(Math.floor(t * engine.fps) % engine.frameCount); requestAnimationFrame(loop); };
    loop();
  }
  window.AG_READY = true;
}
boot().catch(e => { console.error('BOOT FAILED', e.stack || e); window.AG_ERROR = String(e.stack || e); });
