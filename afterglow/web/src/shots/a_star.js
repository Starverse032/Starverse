// a_star — A2 [1212, 1692): long take A, middle section (screenplay S02-d after the midpoint of
// substitution ①, S02-e, S02-f up to the midpoint of substitution ③).  One camera that only moves
// forward, R = (734.5, 540.5) the focus of expansion throughout.
//
//   [1212, 1236)  hand-off from A1 inside the node corona (_corona.js, same function both sides); the
//                 dimmed web behind it is A1's own layer (a_origin/web.js) on WEB_PATH_A
//   [1212, 1331)  the star with volume (a_star/star.js): 120 → 380 px (2.2 → 1.0 %/frame, 24 → 35 mm),
//                 tightening 380 → 260 px (its own radius −40 %, camera +13 %), collapse r₀(1 − u³)
//   [1331, 1344)  a still 4 px point;  f1344 the flash (HDR 10³ at f1348, local, streak)
//   [1344, 1500)  the shell (a_star/shell.js); [1392, 1440) substitution ②: it passes the lens — edge
//                 over-exposure + radial scatter streaks sweep out through the frame edges, the centre
//                 never washes out; the Earth's dark disc (f1400, 160 px) is silhouetted against the far
//                 half of the shell (depth split: far shell → Earth → near shell)
//   [1392, 1680)  the Earth (a_star/earth.js): north up, sun off-frame left, lit crescent on the left
//                 ≈ 45 %, R_geo on the night side just past the terminator, no city lights; exposure
//                 E(t) −5 → 0 EV over [1440, 1584) drives the day side and the star births together;
//                 [1584, 1680) sprint ≤ 6 %/frame then ≤ 8 %/frame with an analytic zoom blur about R,
//                 the view tilts from nadir to the A3 glide (4.5°) so that f1680 is _clouds.js camAt(1680)
//   [1660, 1692)  substitution ③: A3's cloud decks (_clouds.js) fade in over our Earth, from f1680 the
//                 frame is _clouds.js itself (hand-off f1692 to a_descent, same function, same post)
import * as THREE from 'three';
import * as C from './a_star/curves.js';
import { createCorona, coronaPost } from './_corona.js';

const lerp = (a, b, t) => a + (b - a) * t;
const BASE_POST = coronaPost(1212);

export function postAt(fr, cloudsPostFn) {
  if (coronaPost.active(fr)) return coronaPost(fr);
  const p = { ...BASE_POST, tint: [1, 1, 1], lift: [0, 0, 0], streakTint: [0.55, 0.75, 1.0], flashColor: [1, 0.96, 0.9] };
  // the supernova: wider, stronger bloom and the anamorphic streak only around the flash (f1344–1351)
  const fl = C.s5(1342, 1346, fr) * (1 - C.s5(1352, 1372, fr));
  const sh = C.s5(1346, 1360, fr) * (1 - C.s5(1430, 1470, fr));
  p.bloom = lerp(0.75, 0.9, Math.max(fl, sh));
  p.bloomRadius = lerp(1.0, 1.35, Math.max(fl, 0.6 * sh));
  p.streak = lerp(0.12, 0.30, fl);
  // the cloud substitution: blend into A3's post so f1680 → f1692 are identical on both sides
  if (cloudsPostFn && fr >= 1652) {
    const c = cloudsPostFn(Math.round(fr)), k = C.s5(1652, 1680, fr);
    for (const key of Object.keys(c)) if (typeof c[key] === 'number' && typeof p[key] === 'number') p[key] = lerp(p[key], c[key], k);
  }
  return p;
}

export async function create(ctx) {
  const { renderer, W, H } = ctx;
  const A2 = ctx.timeline.shots.find(s => s.id === 'A2');
  const near = (a, b, pad = 0.5) => ctx.inRange(a / 24, b / 24, pad);
  // cloudsPost is a pure function: import it regardless (post() must work even when nothing is built)
  let cloudsMod = null;
  try { cloudsMod = await import('./_clouds.js'); } catch (e) { console.warn('[a_star] _clouds.js not available', e.message); }
  const cloudsPostFn = cloudsMod && cloudsMod.cloudsPost;
  const post = (shot, f) => postAt(f.t * 24, cloudsPostFn);
  if (!ctx.shotInRange(A2, 0.5)) return { render() {}, post };

  const needWeb = near(1200, 1392), needStar = near(1200, 1350), needShell = near(1340, 1530);
  const needEarth = near(1388, 1692), needClouds = near(1656, 1700);
  const t0 = performance.now();
  const corona = createCorona(ctx);
  let web = null, star = null, shell = null, earth = null, clouds = null;
  if (needWeb) { const { createWebLayer } = await import('./a_origin/web.js'); web = createWebLayer(ctx); }
  if (needStar) { const { createStar } = await import('./a_star/star.js'); star = createStar(ctx); }
  if (needShell) { const { createShell } = await import('./a_star/shell.js'); shell = createShell(ctx); }
  if (needEarth) { const { createEarthView } = await import('./a_star/earth.js'); earth = await createEarthView(ctx, { needShellOverlap: needShell }); }
  if (needClouds && cloudsMod) clouds = cloudsMod.createClouds(ctx);
  console.log(`[a_star] built web=${!!web} star=${!!star} shell=${!!shell} earth=${!!earth} clouds=${!!clouds} in ${Math.round(performance.now() - t0)} ms`);

  const webRT = needWeb ? ctx.makeRT(W, H) : null;
  const copy = ctx.kit.compositor();

  function drawWeb(fr, target) {
    if (!web || fr >= 1392) return;
    const fade = 1 - C.s5(1366, 1392, fr);              // swallowed by the shell's glare before it passes the lens
    if (fade <= 0) return;
    web.camera.setFocalLength(C.focalAt(fr));
    if (fade >= 1) { web.render(renderer, target, fr, { clear: true }); return; }
    web.render(renderer, webRT, fr, { clear: true });
    copy.material.uniforms.tex.value = webRT.texture; copy.material.uniforms.gain.value = fade;
    copy.render(renderer, target);
  }

  return {
    post,
    render(shot, f) {
      const fr = f.t * 24;
      const target = f.target;
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
      if (fr >= 1680 && clouds) {
        clouds.render(f);
      } else {
        drawWeb(fr, target);
        if (star && fr < 1360) star.render(fr, target);
        if (fr < 1392) {
          if (shell && fr >= 1344) shell.render(fr, target, 0);
        } else {
          if (shell && fr < 1530) shell.render(fr, target, fr < 1440 ? 1 : 0);
          if (earth && fr < 1500) earth.renderBowl(fr, target);
          if (earth) earth.render(f, { shell, clouds });
          if (shell && fr < 1430) shell.render(fr, target, 2, 1 - 0.6 * C.s5(1392, 1400, fr));
          if (earth && fr < 1440) earth.renderSweep(fr, target);
        }
        corona.render(renderer, target, fr);
      }
      renderer.autoClear = ac;
      renderer.setRenderTarget(target);
    },
  };
}
