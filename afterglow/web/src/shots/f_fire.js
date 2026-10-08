// f_fire — II · 火 FIRE: S15 燧石 · 点燃 (70.0 → 79.0) · S16 火星升空 (79.0 → 86.0) · S17 客星 (86.0 → 95.0).
//
// Human light. The first warm image of the film, then the sparks rise, the camera lifts its head
// over a ridge to the Milky Way, and the campfire becomes a tiny warm point at R under a guest star.
//
//   S15  f_fire/macro.js  — 100 mm macro: flint sparks, ember, tinder, out-of-focus flame (baked,
//                           shadowed, depth-of-field plates re-lit per frame + live emission layers).
//   S16  f_fire/night.js  — 35 mm crane-up + tilt −5° → +62° following a column of sparks to the sky.
//   S17  f_fire/night.js  — 24 mm locked-off landscape: ridge, campfire at R, guest star at (1500, 270);
//                           keeps drawing past 95.0 for the 0.5 s match dissolve into S18.
//
// S16 and S17 share one baked Milky Way (kit.bakeSky) and one star field, so the sky of the tilt is the
// sky of the landscape.
import { createMacro } from './f_fire/macro.js';
import { createNight } from './f_fire/night.js';

export async function create(ctx) {
  const macro = createMacro(ctx);
  const night = createNight(ctx);
  return {
    render(shot, f) {
      // every layer composites onto the previous one: no implicit clears (the modules clear themselves)
      const ac = ctx.renderer.autoClear;
      ctx.renderer.autoClear = false;
      try {
        if (shot.id === 'S15') macro.render(shot, f);
        else night.render(shot, f);
      } finally { ctx.renderer.autoClear = ac; }
    },
    post(shot, f) {
      if (shot.id === 'S15') return macro.post(shot, f);
      return night.post(shot, f);
    },
  };
}
