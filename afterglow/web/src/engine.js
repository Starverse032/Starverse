// The film engine: maps a frame number to (shot, local time), renders the shot into an HDR
// target, handles transitions, letterbox and cards, and runs post. Every frame is a pure
// function of its time, so any frame range can be rendered independently.
import * as THREE from 'three';
import { Post, DEFAULT_POST, makeRT, FSQ } from './post.js';
import { Cards } from './cards.js';
import * as util from './lib/util.js';
import * as GLSL from './lib/glsl.js';
import { createSlate } from './slate.js';
import * as kit from './lib/kit.js';

export class Engine {
  constructor(timeline, { W = 1920, H = 1080, canvas } = {}) {
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
    this.post = new Post(renderer, W, H);
    this.cards = new Cards(W, H, timeline);
    this.modules = new Map();   // module name -> Promise<instance>
    this.shots = timeline.shots;
    // shared context handed to every shot module
    this.ctx = { THREE, renderer, W, H, S: H / 1080, fps: this.fps, timeline, util, GLSL, kit, makeRT, FSQ, engine: this };
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

  frameInfo(shot, t, target, bar) {
    const lt = t - shot.start, dur = shot.end - shot.start;
    return { t, lt, dur, p: lt / dur, target, W: this.W, H: this.H, bar, barPx: bar * this.H, frame: Math.round(t * this.fps), shot };
  }

  async renderShot(i, t, target, bar) {
    const shot = this.shots[i];
    const inst = await this.module(shot.module);
    if (shot.msaa || inst.msaa) {
      if (!this.msaa) this.msaa = [makeRT(this.W, this.H, { depth: true, samples: 4 }), makeRT(this.W, this.H, { depth: true, samples: 4 })];
      target = target === this.rtA ? this.msaa[0] : this.msaa[1];
    }
    const f = this.frameInfo(shot, t, target, bar);
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
    const p = { ...DEFAULT_POST, ...(this.tl.post || {}), ...(shot.post || {}) };
    if (inst.post) Object.assign(p, inst.post(shot, f) || {});
    return p;
  }

  // Sub-frame motion blur: average N renders across the shutter interval (180° by default).
  async renderShotBlurred(i, t, target, bar) {
    const shot = this.shots[i];
    const inst = await this.module(shot.module);
    const n = shot.motionBlur || inst.motionBlur || 0;
    if (!n || n < 2) return this.renderShot(i, t, target, bar);
    if (!this.rtAcc) this.rtAcc = makeRT(this.W, this.H);
    const shutter = (shot.shutter ?? 0.5) / this.fps;
    let P = null;
    for (let k = 0; k < n; k++) {
      const tk = t + shutter * ((k + 0.5) / n - 0.5);
      P = await this.renderShot(i, tk, target, bar);
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
      for (const k of ['exposure', 'bloom', 'streak', 'saturation', 'contrast', 'vignette', 'grain', 'ca', 'bloomThreshold']) P[k] = util.lerp(Pprev[k], P[k], m);
    }
    if (tin.type === 'fade_from_black' && tdur > 0 && lt < tdur) P.fade = Math.max(P.fade, 1 - util.ease.inOutSine(lt / tdur));
    if (tin.type === 'flash' && tdur > 0 && lt < tdur) P.flash += Math.pow(1 - lt / tdur, 2) * (tin.strength ?? 6);
    const tout = shot.transitionOut;
    if (tout && tout.type === 'fade_to_black' && tout.dur > 0) {
      const rem = shot.end - t;
      if (rem < tout.dur) P.fade = Math.max(P.fade, 1 - util.ease.inOutSine(util.clamp(rem / tout.dur)));
    }
    if (tout && tout.type === 'flash' && tout.dur > 0) {
      const rem = shot.end - t;
      if (rem < tout.dur) P.flash += Math.pow(1 - rem / tout.dur, 3) * (tout.strength ?? 6);
    }
    const cardsTex = this.cards.draw(t, bar);
    this.post.run(src, P, { bar, time: t, cardsTex });
    return { shot: shot.id, module: shot.module, t };
  }
}
