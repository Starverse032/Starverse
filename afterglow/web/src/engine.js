// The film engine: maps a frame number to (shot, local time), renders the shot into an HDR
// target, handles transitions, letterbox and cards, and runs post. Every frame is a pure
// function of its time, so any frame range can be rendered independently.
//
// v2 additions (docs/engine.md §v2):
//   E2  transitionIn.type = 'handoff' (a hard cut that the two modules make pixel-continuous) and
//       transitionIn.postBlend = n (any hard cut: post params eased over n frames from the previous shot's
//       last-frame values); f.transition / f.handoffIn / f.handoffOut tell a module where it stands.
//   E3  a module may export motionBlur(f) → sub-frame count (or { n, shutter }) per frame.
//   E4  ctx.range / ctx.rangeFrames / ctx.inRange() / ctx.shotInRange(): the frames this process renders.
//   V2  bloom mask: a module with `bloomMask` gets f.mask (RGBA8 RT, cleared to 0 each frame):
//       R = pixel does not feed bloom/streak, G = pixel receives no bloom, B = pixel receives no streak.
//   flash transitions take a colour (transitionIn/Out.color: [r,g,b] linear | '#RRGGBB' | palette name).
import * as THREE from 'three';
import { Post, DEFAULT_POST, makeRT, FSQ } from './post.js';
import { Cards } from './cards.js';
import * as util from './lib/util.js';
import * as GLSL from './lib/glsl.js';
import { createSlate } from './slate.js';
import * as kit from './lib/kit.js';

const HARD_CUTS = new Set(['cut', 'match', 'smash', 'handoff']);
const DISSOLVE_KEYS = ['exposure', 'bloom', 'streak', 'saturation', 'contrast', 'vignette', 'grain', 'ca', 'bloomThreshold'];

// Timeline items may carry `frames: [a, b)`; they are the source of truth and give exact start/end
// (start = a / fps is the same double the engine computes for frame a, so boundaries never drift).
export function normalizeTimeline(tl) {
  const fps = tl.fps || 24;
  for (const key of ['shots', 'cards', 'subtitles', 'credits', 'silences']) {
    for (const it of tl[key] || []) {
      if (Array.isArray(it.frames) && it.frames.length === 2) { it.start = it.frames[0] / fps; it.end = it.frames[1] / fps; }
    }
  }
  return tl;
}

// '#RRGGBB' (sRGB, decoded to linear) | palette name (hex or linear array) | [r, g, b] linear → [r, g, b] linear, or null
export function resolveColor(c, palette = {}) {
  if (Array.isArray(c) && c.length >= 3) return c.slice(0, 3).map(Number);
  if (typeof c !== 'string') return null;
  if (Array.isArray(palette[c])) return resolveColor(palette[c]);   // e.g. "AMBER_FLASH_LINEAR"
  const hex = /^#[0-9a-f]{6}$/i.test(c) ? c : (palette[c] && /^#[0-9a-f]{6}$/i.test(palette[c]) ? palette[c] : null);
  if (!hex) return null;
  const dec = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return [1, 3, 5].map(i => dec(parseInt(hex.slice(i, i + 2), 16) / 255));
}

// Interpolate every numeric (and numeric-array) post parameter; non-numeric values switch at m = 0.5.
export function lerpPost(a, b, m) {
  const out = { ...b };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k];
    if (typeof x === 'number' && typeof y === 'number') out[k] = util.lerp(x, y, m);
    else if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) out[k] = x.map((v, j) => util.lerp(v, y[j], m));
    else if (y === undefined) out[k] = x;
    else out[k] = m < 0.5 && x !== undefined ? x : y;
  }
  return out;
}

export class Engine {
  constructor(timeline, { W = 1920, H = 1080, canvas, range = null } = {}) {
    normalizeTimeline(timeline);
    this.tl = timeline; this.W = W; this.H = H; this.fps = timeline.fps || 24;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.autoClear = true;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // we convert manually in post
    renderer.toneMapping = THREE.NoToneMapping;
    this.renderer = renderer;
    this.rtA = makeRT(W, H, { depth: true });
    this.rtB = makeRT(W, H, { depth: true });
    this.msaa = null; // lazily created 4x MSAA pair for shots with hard geometric edges (shot.msaa or module.msaa)
    this.rtMix = makeRT(W, H);
    this.rtAcc = null; // motion-blur accumulation (lazy)
    this.maskRT = null; // V2 bloom mask (lazy, RGBA8)
    this.post = new Post(renderer, W, H);
    this.cards = new Cards(W, H, timeline);
    this.modules = new Map();   // module name -> Promise<instance>
    this.shots = timeline.shots;
    // frame boundaries and the cut on each side of every shot
    const fr = this.fps;
    this.shotFrames = this.shots.map(s => [Math.round(s.start * fr), Math.round(s.end * fr)]);
    this.links = this.shots.map((s, i) => {
      const prev = this.shots[i - 1], next = this.shots[i + 1];
      const tin = s.transitionIn || { type: 'cut' }, tout = next ? (next.transitionIn || { type: 'cut' }) : null;
      return {
        in: prev ? { type: tin.type || 'cut', from: prev.id, fromModule: prev.module, frame: this.shotFrames[i][0], postBlend: tin.postBlend || 0 } : null,
        out: next ? { type: tout.type || 'cut', to: next.id, toModule: next.module, frame: this.shotFrames[i + 1][0], postBlend: tout.postBlend || 0 } : null,
      };
    });
    // E4: the frames this process will render, [f0, f1). Default: the whole film.
    const total = Math.round(timeline.duration * fr);
    const rf = range && Number.isFinite(range[0]) && Number.isFinite(range[1]) ? [Math.max(0, range[0] | 0), Math.min(total, range[1] | 0)] : [0, total];
    const rangeT = [rf[0] / fr, rf[1] / fr];
    // does [a, b) (seconds; a single time when b is omitted) come within `pad` seconds of the range?
    const inRange = (a, b = a, pad = 1.0) => (b > a ? b : a + 1e-9) > rangeT[0] - pad && a < rangeT[1] + pad;
    // shared context handed to every shot module
    this.ctx = {
      THREE, renderer, W, H, S: H / 1080, fps: this.fps, timeline, util, GLSL, kit, makeRT, FSQ, engine: this,
      range: rangeT, rangeFrames: rf, inRange,
      shotInRange: (shot, pad = 1.0) => inRange(shot.start, shot.end, pad),
    };
  }

  get duration() { return this.tl.duration; }
  get frameCount() { return Math.round(this.tl.duration * this.fps); }

  shotIndexAt(t) {
    const s = this.shots;
    for (let i = 0; i < s.length; i++) if (t >= s[i].start && t < s[i].end) return i;
    return t < s[0].start ? 0 : s.length - 1;
  }

  async module(name) {
    if (!this.modules.has(name)) {
      this.modules.set(name, (async () => {
        let mod;
        try {
          mod = await import(`./shots/${name}.js`);
        } catch (e) {
          if (!String(e.message).match(/Failed to fetch|404|Cannot find|error loading/i)) console.error(`shot module ${name} failed to load:`, e.message);
          return createSlate(this.ctx, name, String(e.message).slice(0, 120));
        }
        return await mod.create(this.ctx);
      })());
    }
    return this.modules.get(name);
  }

  // letterbox bar height as a fraction of H at time t
  barAt(t) {
    const keys = this.tl.letterbox || [{ t: 0, aspect: 2.39, dur: 0 }];
    let aspect = keys[0].aspect;
    let prev = keys[0].aspect;
    for (const k of keys) {
      if (t < k.t) break;
      const u = k.dur > 0 ? util.clamp((t - k.t) / k.dur) : 1;
      const e = (util.ease[k.ease || 'inOutCubic'] || util.ease.inOutCubic)(u);
      aspect = 1 / util.lerp(1 / prev, 1 / k.aspect, e); // interpolate visible height linearly
      prev = k.aspect;
    }
    const visH = Math.min(this.H, this.W / aspect);
    return (this.H - visH) / 2 / this.H;
  }

  // Frame info handed to render()/post()/motionBlur(). `i` is the shot index (needed for the cut links).
  frameInfo(shot, t, target, bar, i = this.shots.indexOf(shot)) {
    const lt = t - shot.start, dur = shot.end - shot.start;
    const frame = Math.round(t * this.fps);
    const L = this.links[i] || { in: null, out: null };
    const tin = L.in && { ...L.in, k: frame - L.in.frame };      // frames since the incoming cut (0 on its first frame)
    const tout = L.out && { ...L.out, k: L.out.frame - frame };  // frames until the outgoing cut (1 on the last frame; ≤ 0 in a dissolve tail)
    return {
      t, lt, dur, p: lt / dur, target, W: this.W, H: this.H, bar, barPx: bar * this.H, frame, shot,
      transition: { in: tin, out: tout },
      handoffIn: tin && tin.type === 'handoff' ? tin : null,
      handoffOut: tout && tout.type === 'handoff' ? tout : null,
      sub: 0, subs: 1, mask: null,
    };
  }

  // The merged post params of shot i at time t: DEFAULT_POST ← timeline.post ← shot.post ← module.post(shot, f)
  mergePost(shot, inst, f) {
    const p = { ...DEFAULT_POST, ...(this.tl.post || {}), ...(shot.post || {}) };
    if (inst.post) Object.assign(p, inst.post(shot, f) || {});
    return p;
  }

  async postAt(i, t, bar) {
    const shot = this.shots[i];
    const inst = await this.module(shot.module);
    return this.mergePost(shot, inst, this.frameInfo(shot, t, null, bar, i));
  }

  // V2: does this shot draw a bloom mask on this frame?
  wantsMask(shot, inst, f) {
    const m = inst.bloomMask ?? shot.bloomMask;
    return typeof m === 'function' ? !!m(f) : !!m;
  }

  async renderShot(i, t, target, bar, sub = 0, subs = 1) {
    const shot = this.shots[i];
    const inst = await this.module(shot.module);
    if (shot.msaa || inst.msaa) {
      if (!this.msaa) this.msaa = [makeRT(this.W, this.H, { depth: true, samples: 4 }), makeRT(this.W, this.H, { depth: true, samples: 4 })];
      target = target === this.rtA ? this.msaa[0] : this.msaa[1];
    }
    const f = this.frameInfo(shot, t, target, bar, i);
    f.sub = sub; f.subs = subs;
    if (this.wantsMask(shot, inst, f)) {
      if (!this.maskRT) this.maskRT = makeRT(this.W, this.H, { type: THREE.UnsignedByteType, depth: false });
      if (!this.maskUsed) {     // cleared once per output frame; sub-frames and dissolve partners draw into the same mask
        this.renderer.setRenderTarget(this.maskRT);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear(true, false, false);
        this.maskUsed = true;
      }
      f.mask = this.maskRT;
    }
    // scissor to the visible band (saves fill rate under the letterbox)
    const y0 = Math.floor(f.barPx), h = this.H - 2 * y0;
    target.viewport.set(0, 0, this.W, this.H);
    target.scissorTest = false;
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear(true, true, true);
    target.scissor.set(0, y0, this.W, h); target.scissorTest = y0 > 0;
    this.renderer.setRenderTarget(target);
    inst.render(shot, f);
    target.scissorTest = false;
    f.target = target;
    this.lastTarget = target;
    return this.mergePost(shot, inst, f);
  }

  // Sub-frame motion blur: average N renders across the shutter interval (180° by default).
  // N = shot.motionBlur (timeline, number) || module.motionBlur (number, or E3: function(f) → n | { n, shutter }).
  async renderShotBlurred(i, t, target, bar) {
    const shot = this.shots[i];
    const inst = await this.module(shot.module);
    let n = shot.motionBlur || 0, shutterFrac = shot.shutter ?? 0.5;
    if (!n && inst.motionBlur) {
      let r = inst.motionBlur;
      if (typeof r === 'function') r = r(this.frameInfo(shot, t, null, bar, i));
      if (r && typeof r === 'object') { if (r.shutter != null) shutterFrac = r.shutter; r = r.n; }
      n = r || 0;
    }
    n = Math.min(64, Math.round(n));
    if (!n || n < 2) return this.renderShot(i, t, target, bar);
    if (!this.rtAcc) this.rtAcc = makeRT(this.W, this.H);
    const shutter = shutterFrac / this.fps;
    let P = null;
    for (let k = 0; k < n; k++) {
      const tk = t + shutter * ((k + 0.5) / n - 0.5);
      P = await this.renderShot(i, tk, target, bar, k, n);
      this.post.accumulate(this.lastTarget, this.rtAcc, k === 0 ? 1 : 1 / (k + 1));
    }
    this.lastTarget = this.rtAcc;
    return P;
  }

  async renderFrame(frame) {
    const t = frame / this.fps;
    const i = this.shotIndexAt(t);
    const shot = this.shots[i];
    const bar = this.barAt(t);
    const lt = t - shot.start;
    this.maskUsed = false;
    let P = await this.renderShotBlurred(i, t, this.rtA, bar);
    let src = this.lastTarget;
    const tin = shot.transitionIn || { type: 'cut', dur: 0 };
    const tdur = tin.dur || 0;
    if (tin.type === 'dissolve' && tdur > 0 && lt < tdur && i > 0) {
      // previous shot keeps running past its end for the length of the dissolve
      const Pprev = await this.renderShotBlurred(i - 1, t, this.rtB, bar);
      const prevTarget = this.lastTarget;
      const m = util.ease.inOutSine(util.clamp(lt / tdur));
      this.post.blend(prevTarget, src, m, this.rtMix);
      src = this.rtMix;
      for (const k of DISSOLVE_KEYS) P[k] = util.lerp(Pprev[k], P[k], m);
    }
    // E2: postBlend on a hard cut / handoff — frame k after the cut uses mix(prev last-frame post, own post, ease(k/n));
    // the cut frame itself (k = 0) carries exactly the previous frame's post.
    const pb = tin.postBlend | 0;
    if (pb > 0 && i > 0 && HARD_CUTS.has(tin.type || 'cut')) {
      const k = frame - this.shotFrames[i][0];
      if (k >= 0 && k < pb) {
        const Pprev = await this.postAt(i - 1, (this.shotFrames[i][0] - 1) / this.fps, bar);
        P = lerpPost(Pprev, P, util.ease.inOutSine(k / pb));
      }
    }
    const pal = this.tl.palette || {};
    if (tin.type === 'fade_from_black' && tdur > 0 && lt < tdur) P.fade = Math.max(P.fade, 1 - util.ease.inOutSine(lt / tdur));
    if (tin.type === 'flash' && tdur > 0 && lt < tdur) {
      P.flash += Math.pow(1 - lt / tdur, 2) * (tin.strength ?? 6);
      const c = resolveColor(tin.color, pal); if (c) P.flashColor = c;
    }
    const tout = shot.transitionOut;
    if (tout && tout.type === 'fade_to_black' && tout.dur > 0) {
      const rem = shot.end - t;
      if (rem < tout.dur) P.fade = Math.max(P.fade, 1 - util.ease.inOutSine(util.clamp(rem / tout.dur)));
    }
    if (tout && tout.type === 'flash' && tout.dur > 0) {
      const rem = shot.end - t;
      if (rem < tout.dur) {
        P.flash += Math.pow(1 - rem / tout.dur, 3) * (tout.strength ?? 6);
        const c = resolveColor(tout.color, pal); if (c) P.flashColor = c;
      }
    }
    const cardsTex = this.cards.draw(t, bar);
    this.post.run(src, P, { bar, time: t, cardsTex, mask: this.maskUsed ? this.maskRT : null });
    return { shot: shot.id, module: shot.module, t };
  }
}
