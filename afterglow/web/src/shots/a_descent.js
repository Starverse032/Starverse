// a_descent — A3 · 长镜头 A③ · S02-f 中段 [1692, 1758): out of the clouds, the East African Rift at dusk,
// the savanna, an acacia branch, the grass — falling towards the heap of tinder at R.
//
// One world (a_descent/world.js) seen by one camera track (_clouds.js: a 4.5° glide line straight at the
// target, so the focus of expansion is R on every frame; the per-frame magnification at R follows the
// screenplay's rate track: 置换③ clouds → sprint 10 % → 8 % → 置换④ acacia → sprint 8 % → 置换⑤ grass).
//   [1692, 1712)  the shared cloud decks (_clouds.js) over the world: in-cloud, then under the base
//   [1704, 1740)  the Rift: west wall a silhouette against the west glow (left), lake upper-left, cones,
//                 the floor going dark; from ≈ f1728 acacias stream out past the frame edges
//   [1740, 1746)  置换④: the acacia branch wipe (_sweep.js) — the view behind it goes 1.35 km → 60 m
//   [1746, 1756)  grass tufts, stones, the ground coming up
//   [1756, 1758)  置换⑤: the grass wipe + the veil (_sweep.js), handed to A4 at f1758
// Every frame: world → HDR target (band-scissored) → analytic radial zoom blur at R (half the frame's
// displacement; capped in the substitutions) → [clouds] → the wipes. No sub-frames.
import { createClouds, cloudsPost, createZoomBlur, camAt } from './_clouds.js';
import { createSweep, sweepPost } from './_sweep.js';
import { createWorld } from './a_descent/world.js';

export async function create(ctx) {
  const { renderer, W, H, makeRT } = ctx;
  const me = ctx.timeline.shots.find(s => s.id === 'A3');
  let built = null;
  const build = () => {
    if (built) return built;
    built = {
      clouds: createClouds(ctx), sweep: createSweep(ctx), world: createWorld(ctx), blur: createZoomBlur(ctx),
      rtW: makeRT(W, H, { depth: true }),
      rtH: makeRT(Math.round(W / 2), Math.round(H / 2), { depth: true }),   // the world under the clouds: half res
    };
    return built;
  };
  if (me && ctx.shotInRange(me, 0.5)) build();          // E4: nothing is built for a block that never draws A3
  return {
    render(shot, f) {
      const B = build();
      const n = f.t * 24;
      const ac = renderer.autoClear; renderer.autoClear = false;
      // the world (sky, terrain, trees, grass, stones) into our own HDR target, inside the visible band
      const cloudy = !(camAt(n).alt < 4000 && n >= 1712);
      const rt = cloudy ? B.rtH : B.rtW, k = cloudy ? 0.5 : 1;
      const y0 = Math.floor(f.barPx * k);
      B.world.setFrame(n);
      rt.scissor.set(0, y0, rt.width, rt.height - 2 * y0); rt.scissorTest = y0 > 0;
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
      if (n > 1692) renderer.render(B.world.scene, B.world.camera);
      rt.scissorTest = false;
      if (!cloudy) B.blur.apply(B.rtW.texture, f.target, n);
      // clouds over the world, then the zoom blur. At the hand-off (f1692) the world under the clouds is the
      // shared built-in one (= what A2 draws); ours takes over behind the deck by f1700
      else B.clouds.render(f, { base: B.rtH.texture, baseMix: Math.min(1, Math.max(0, (n - 1692) / 8)) });
      B.sweep.drawOver(f);
      renderer.autoClear = ac;
      renderer.setRenderTarget(f.target);
    },
    post(shot, f) { return f.frame >= 1756 ? sweepPost(f.frame) : cloudsPost(f.frame); },
  };
}
