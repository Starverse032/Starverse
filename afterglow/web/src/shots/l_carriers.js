// l_carriers — L1 · S04 中央光源的载体递进 [2280, 2784), 1:35.00–1:56.00.
//
// One locked shot whose light centre never leaves C = (960, 540): campfire → candle → hurricane
// lantern → incandescent bulb → a modern lamp behind a tall window, then a visible scale deformation
// (fixed point = the lamp's light centre) that grows a city around the window and bends the lamp
// sheet into the night side of the Earth (R_geo on C).
//   f2280      match cut from F3's distant warm point at C (same pixel)
//   gaps       [2345,2352) [2417,2424) [2489,2496) [2561,2568) (shot.params.darkGaps): light out →
//              4 frames of the old carrier's dark ember outline → 3 frames dissolving into the new
//              carrier's outline → the new light on the downbeat
//   S04-f      [2664, 2784): l_carriers/sheet.js (window, city, globe — one parametric light sheet)
// Every carrier is a single fullscreen shader with analytic geometry (surfaces of revolution under a
// near-orthographic long lens, SDF outlines, Voronoi coals, advected-noise flames); the window, city
// and globe share one ray-cast surface. render() is a pure function of f.t.
import { carrierTable, outlineOld, outlineNew, bakeNoise } from './l_carriers/common.js';
import { createFire } from './l_carriers/fire.js';
import { createCandle } from './l_carriers/candle.js';
import { createLantern } from './l_carriers/lantern.js';
import { createBulb } from './l_carriers/bulb.js';
import { createSheet } from './l_carriers/sheet.js';

// Post per carrier (visual-changes §1.3): fire 0.75/1.0, candle 0.5/0.6, lantern 0.4/0.6, bulb 0.6/0.4,
// window 0.3/1.2, city / globe 0.55 (S18); no anamorphic streak anywhere in S04 (that is the cursor's
// and the stars' mark). Changes happen only inside the dark gaps, where nothing is above threshold.
const POST = {
  fire: { bloom: 0.75, bloomRadius: 1.0, streak: 0, bloomThreshold: 1.0, vignette: 0.2 },
  candle: { bloom: 0.5, bloomRadius: 0.6, streak: 0, bloomThreshold: 1.0, vignette: 0.2 },
  lantern: { bloom: 0.4, bloomRadius: 0.6, streak: 0, bloomThreshold: 1.0, vignette: 0.2 },
  bulb: { bloom: 0.6, bloomRadius: 0.4, streak: 0, bloomThreshold: 1.0, vignette: 0.2 },
  sheet: { bloom: 0.3, bloomRadius: 1.2, streak: 0, bloomThreshold: 1.0, vignette: 0.2 },
  city: { bloom: 0.55, bloomRadius: 1.0, streak: 0.04, bloomThreshold: 1.0, vignette: 0.22 },
};

export async function create(ctx) {
  const { renderer, util } = ctx;
  const shot = ctx.timeline.shots.find(s => s.id === 'L1') || { frames: [2280, 2784], params: {} };
  const T = carrierTable(shot);
  const need = (a, b) => (ctx.inRange ? ctx.inRange(a / 24, b / 24, 0.5) : true);
  const noise = bakeNoise(ctx.kit, renderer);
  const passes = {};
  if (need(T[0].on - 3, T[0].next)) passes.fire = createFire(ctx, noise, T[0]);
  if (need(T[1].on - 3, T[1].next)) passes.candle = await createCandle(ctx, noise, T[1]);
  if (need(T[2].on - 3, T[2].next)) passes.lantern = await createLantern(ctx, noise, T[2]);
  if (need(T[3].on - 3, T[3].next)) passes.bulb = await createBulb(ctx, noise, T[3]);
  if (need(T[4].on - 3, T[4].next)) passes.sheet = await createSheet(ctx, noise, T[4], shot);

  // which carriers draw on a (float) frame, with their outline weights
  function layers(fr) {
    const out = [];
    const fi = Math.round(fr);
    for (let i = 0; i < T.length; i++) {
      const c = T[i];
      const prev = i > 0 ? T[i - 1] : null;
      const from = i === 0 ? c.on : c.on - 3;
      if (fi < from || fi >= c.next) continue;
      let w = 0;
      if (fi >= c.dark) w = outlineOld(fi, c);
      if (prev && fi < c.on + 3) w = Math.max(w, outlineNew(fi, c));
      out.push({ c, w });
    }
    return out;
  }

  return {
    render(sh, f) {
      const fr = f.t * 24;
      const L = layers(fr);
      let first = true;
      for (const { c, w } of L) {
        const P = passes[c.name];
        if (!P) continue;
        P.render(f.target, fr, f.t, w, !first, util, f);
        first = false;
      }
      if (first) { renderer.setRenderTarget(f.target); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, false); }
    },
    post(sh, f) {
      const fr = Math.round(f.t * 24);
      let name = 'sheet';
      for (const c of T) if (fr >= (c === T[0] ? c.on : c.on - 3) && fr < c.next) name = c.name;
      if (name === 'sheet' && passes.sheet && passes.sheet.postFor) return passes.sheet.postFor(f.t * 24);
      if (name === 'sheet') return sheetPost(f.t * 24, T[4]);
      return POST[name];
    },
    motionBlur(f) {
      // the fastest part of the scale deformation gets real sub-frames (radial zoom ≥ 15 %/frame)
      const fr = f.t * 24;
      return fr >= 2722 && fr < 2768 ? { n: 3, shutter: 0.5 } : 0;
    },
  };
}

// post() must not depend on what create() built (E4): the sheet's optics as a pure function of fr
export function sheetPost(fr, c) {
  const a = POST.sheet, b = POST.city;
  const k = Math.min(1, Math.max(0, (fr - 2700) / 30));
  const e = k * k * (3 - 2 * k);
  const o = {};
  for (const key of Object.keys(a)) o[key] = a[key] + (b[key] - a[key]) * e;
  return o;
}
