// f_fire — v2 A4 / F1 / F2 / F3 (screenplay S02-f end + S02-g, S03-a / b / c).
//
//   A4 [1758, 1872)  f_fire/macro.js — the end of long take A: out of the shared grass wipe (`_sweep.js`,
//                    A3's) into the 100 mm macro on the tinder, decelerating 6 % → 0 to a stop at f1776;
//                    the flint's three strikes (1788 / 1812 / 1836), the heated spot, the footprint and the
//                    first flame (1848). Dusk light from the west (screen left).
//   F1 [1872, 1968)  f_fire/night.js — 50 mm, low: the small flame climbs into the twig teepee (120 → 260 px),
//                    the fire light spreads over the stones; the last dark-red line of dusk on the left horizon.
//   F2 [1968, 2112)  f_fire/night.js — 35 mm crane + tilt −5° → +62° after a column of sparks; all dead by f2088.
//   F3 [2112, 2280)  f_fire/night.js — 24 mm locked landscape: ridge, the campfire at C = (960, 540) for the
//                    light-centre match into L1 at f2280, the guest star f2136, card ②.
//
// E4: only the sub-scenes this process will render are built (ctx.range): the macro set + its plates for A4,
// the campfire set (+ its baked plates) for F1 / F2, the sky for F1–F3, the landscape for F3.
// post() is an analytic function of the frame and never depends on what create() built.
import { createMacro } from './f_fire/macro.js';
import { createNight } from './f_fire/night.js';
import { createSweep, sweepPost } from './_sweep.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;

export function firePost(id, n) {
  if (id === 'A4') {
    // f1758 = the A3 post (sweepPost, no postBlend needed); eases to the fire look by the stop
    const k = ss(1762, 1776, n);
    const p = sweepPost(n);
    return { ...p, bloom: lerp(p.bloom, 0.75, k), vignette: lerp(p.vignette, 0.28, k), grain: 0.04, streak: 0 };
  }
  if (id === 'F1') return { exposure: 1.0, bloom: 0.75, bloomThreshold: 1.0, bloomKnee: 0.6, streak: 0, vignette: 0.26, grain: 0.04, ca: 0.0006 };
  if (id === 'F2') {
    const k = ss(1990, 2050, n);                          // fire → stars: a short streak only once the sky leads
    return { exposure: 1.0, bloom: 0.75, bloomThreshold: 1.0, bloomKnee: 0.6, streak: 0.16 * k, streakTint: [0.7, 0.8, 1.0], vignette: 0.26, grain: 0.04, ca: 0.0006 };
  }
  return { exposure: 1.0, bloom: 0.72, bloomThreshold: 1.0, bloomKnee: 0.6, streak: 0.2, streakTint: [0.7, 0.8, 1.0], vignette: 0.24, grain: 0.04, ca: 0.0006 };
}

export async function create(ctx) {
  const shot = id => ctx.timeline.shots.find(s => s.id === id);
  const need = id => { const s = shot(id); return !!s && ctx.shotInRange(s, 0.5); };
  const nA4 = need('A4'), nF1 = need('F1'), nF2 = need('F2'), nF3 = need('F3');
  const macro = nA4 ? createMacro(ctx) : null;
  const sweep = nA4 ? createSweep(ctx) : null;
  const night = (nF1 || nF2 || nF3) ? createNight(ctx, { F1: nF1, F2: nF2, F3: nF3 }) : null;
  return {
    render(shot, f) {
      const ac = ctx.renderer.autoClear;
      ctx.renderer.autoClear = false;
      try {
        if (shot.id === 'A4') {
          macro.render(shot, f);
          if (f.t * 24 < 1762) sweep.drawOver(f);         // the shared veil + grass wipe (置换⑤), A3's code
        } else night.render(shot, f);
      } finally { ctx.renderer.autoClear = ac; ctx.renderer.setRenderTarget(f.target); }
    },
    post(shot, f) { return firePost(shot.id, f.t * 24); },
  };
}
