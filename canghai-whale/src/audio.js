import { clamp } from './util.js';

/** Everything you hear is synthesised on the fly with the Web Audio API — no sound files. */
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.birdT = 3;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    // shared noise buffers
    const len = ctx.sampleRate * 2;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      last = (last + 0.02 * x) / 1.02;
      b[i] = last * 3.5;
    }
    // wind: looped noise through a band-pass that opens with speed
    const src = ctx.createBufferSource();
    src.buffer = this.brown;
    src.loop = true;
    this.windF = ctx.createBiquadFilter();
    this.windF.type = 'bandpass';
    this.windF.frequency.value = 400;
    this.windF.Q.value = 0.6;
    this.windG = ctx.createGain();
    this.windG.gain.value = 0;
    src.connect(this.windF).connect(this.windG).connect(this.master);
    src.start();
    // a second, hissier layer for very high speed
    const src2 = ctx.createBufferSource();
    src2.buffer = this.white;
    src2.loop = true;
    this.hissF = ctx.createBiquadFilter();
    this.hissF.type = 'highpass';
    this.hissF.frequency.value = 2500;
    this.hissG = ctx.createGain();
    this.hissG.gain.value = 0;
    src2.connect(this.hissF).connect(this.hissG).connect(this.master);
    src2.start();
    // city bed
    const src3 = ctx.createBufferSource();
    src3.buffer = this.brown;
    src3.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    this.cityG = ctx.createGain();
    this.cityG.gain.value = 0.05;
    src3.connect(lp).connect(this.cityG).connect(this.master);
    src3.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  update(dt, speed, night, altitude) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const k = clamp((speed - 5) / 34, 0, 1);
    this.windG.gain.setTargetAtTime(Math.pow(k, 1.4) * 0.55 + clamp(altitude / 400, 0, 0.12), t, 0.12);
    this.windF.frequency.setTargetAtTime(280 + k * 1500, t, 0.15);
    this.hissG.gain.setTargetAtTime(Math.pow(clamp((speed - 20) / 30, 0, 1), 2) * 0.05, t, 0.2);
    this.cityG.gain.setTargetAtTime(0.05 * clamp(1 - altitude / 250, 0.3, 1), t, 0.5);
    // birdsong by day, crickets at night
    this.birdT -= dt;
    if (this.birdT <= 0) {
      if (night < 0.5) { this.birdT = 1.5 + Math.random() * 6; this._bird(); } else { this.birdT = 0.35 + Math.random() * 0.4; this._cricket(); }
    }
  }

  _env(g, t0, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  _tone(type, f0, f1, dur, peak, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    this._env(g, t0, 0.008, dur, peak);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  _noise(buf, type, f0, f1, q, dur, peak, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = ctx.createGain();
    this._env(g, t0, 0.004, dur, peak);
    s.connect(f).connect(g).connect(this.master);
    s.start(t0, Math.random() * 1.5);
    s.stop(t0 + dur + 0.05);
  }

  thwip() {
    this._noise(this.white, 'bandpass', 3200, 700, 2.5, 0.16, 0.5);
    this._tone('triangle', 1500, 420, 0.12, 0.12);
    this._tone('sine', 300, 180, 0.08, 0.15, 0.08);
  }
  release() { this._noise(this.white, 'bandpass', 900, 2600, 1.5, 0.1, 0.16); }
  jump() { this._tone('sine', 210, 120, 0.12, 0.3); this._noise(this.white, 'lowpass', 1200, 300, 0.7, 0.09, 0.12); }
  airjump() {
    // a little whale spout: rising bubble + spray
    this._tone('sine', 380, 980, 0.16, 0.26);
    this._tone('sine', 620, 1500, 0.12, 0.12, 0.05);
    this._noise(this.white, 'highpass', 2500, 5000, 0.7, 0.22, 0.14);
  }
  land(k) { this._tone('sine', 110, 42, 0.2, 0.5 * k + 0.1); this._noise(this.brown, 'lowpass', 700, 150, 0.7, 0.18, 0.5 * k + 0.1); }
  step(k) { this._noise(this.white, 'lowpass', 1400 + Math.random() * 500, 500, 0.8, 0.045, 0.06 * k); }
  grab() { this._noise(this.brown, 'lowpass', 900, 300, 0.8, 0.07, 0.35); }
  vault() { this._noise(this.white, 'bandpass', 700, 1500, 1, 0.12, 0.1); }
  noanchor() { this._tone('square', 190, 140, 0.09, 0.05); }
  token() {
    const base = 880;
    [0, 4, 7, 12].forEach((s, i) => this._tone('sine', base * Math.pow(2, s / 12), base * Math.pow(2, s / 12), 0.5, 0.16, i * 0.055));
  }
  fanfare() {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this._tone('triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.7, 0.14, i * 0.09));
  }
  ui() { this._tone('sine', 660, 880, 0.06, 0.1); }
  _bird() {
    const f = 2400 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this._tone('sine', f * (1 + 0.15 * Math.random()), f * (0.8 + 0.5 * Math.random()), 0.07 + Math.random() * 0.06, 0.018 + Math.random() * 0.012, i * (0.09 + Math.random() * 0.05));
  }
  _cricket() {
    const f = 4200 + Math.random() * 300;
    for (let i = 0; i < 3; i++) this._tone('sine', f, f, 0.025, 0.008, i * 0.045);
  }
}
