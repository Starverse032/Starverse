// m_asking — S05 · 天线与射电设施的发问蒙太奇, seven cuts M1–M7 [2784, 2928) (36/30/24/18/14/10/12 frames).
//
// Seven facilities, one night, one rule: the only artificial light is the feed's red lamp (RED_LAMP, linear
// (1.0, 0.06, 0.05) × 0.6, HDR ≤ 0.6, + its own 10 px red halo at 30 %); only M6 has the town below, dim and
// out of focus. Lamp on C for M1–M4, none in M5 (the array's vanishing point on R), on R for M6–M7. Drift
// direction alternates a →, b ←, c →, d ←, e →, f ←; M7 is a vertical plunge into the amber flash.
//
//   M1  m_asking/ridge.js    山脊上的孤碟        50 mm, low angle; servo raises the dish 3°
//   M2  m_asking/array.js    山谷里六口天线      35 mm, high side view; six dishes slew together
//   M3  m_asking/inside.js   碟面内侧            24 mm, from under the rim up into the bowl, feed legs on the Milky Way
//   M4  m_asking/antenna.js  天坑巨碟            50 mm, the v1.3 S23 image (single-line ellipse), lamp moved to C
//   M5  m_asking/dipoles.js  偶极子天线阵        35 mm, oblique from above; rows of crosses converge on R
//   M6  m_asking/town.js     小镇边的碟          50 mm; lamp on R, sodium town out of focus below (≤ 40/255)
//   M7  m_asking/dive.js     俯冲 · 琥珀闪光     35 mm straight down onto the sinkhole dish; lamp on R grows
//                                                over f2916–2923; amber flash peaks on f2924 (post())
// Each cut is built only when its frames are in this process's range (ctx.range, E4); post() never needs a build.
import { createRidge } from './m_asking/ridge.js';
import { createArray } from './m_asking/array.js';
import { createInside } from './m_asking/inside.js';
import { createAntenna } from './m_asking/antenna.js';
import { createDipoles } from './m_asking/dipoles.js';
import { createTown } from './m_asking/town.js';
import { createDive, divePost } from './m_asking/dive.js';
import { POST } from './m_asking/kit5.js';

const BUILD = { M1: createRidge, M2: createArray, M3: createInside, M4: createAntenna, M5: createDipoles, M6: createTown, M7: createDive };

export async function create(ctx) {
  const cuts = {};
  for (const s of ctx.timeline.shots) {
    if (!BUILD[s.id] || s.module !== 'm_asking') continue;
    if (ctx.shotInRange(s, 0.5)) cuts[s.id] = BUILD[s.id](ctx, s);
  }
  return {
    msaa: false,
    render(shot, f) {
      const c = cuts[shot.id];
      if (c) return c.render(shot, f);
      ctx.renderer.setRenderTarget(f.target); ctx.renderer.setClearColor(0x000000, 1); ctx.renderer.clear();
    },
    post(shot, f) { return shot.id === 'M7' ? divePost(shot, f) : { ...POST }; },
  };
}
