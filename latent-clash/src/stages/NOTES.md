# STAGE module (LC.stages) — notes

## Progress / next steps (truthful as of the last session)
- [x] core.js (registry, Pix painter, parallax, line-scroll floor), glyphs.js (baked), viewer, shots tool
- [x] library (3 iteration rounds) · abyss (4 rounds) · latent (3 rounds) · training (1 round, simple by design)
- [x] bench: 0 uncovered px at camX 0/256 under ±8 px shake on all stages; draw avg 0.3–0.8 ms
- [ ] polish candidates: library rose window still a bit "wheel"-like, desk only visible near camX 0;
      latent aurora reads as soft bumps more than curtains; abyss floor caustics slightly noisy.

## Files
- `glyphs.js` — Fusion Pixel glyphs (8/10/12 px) for the few strings stages draw. Regenerate with
  `node tools/stages-glyphs.mjs` (edit the HANZI/ASCII lists there). Stages never depend on LC.font.
- `core.js` — `LC.stages` API + `LC.stages.U` helpers:
  - `U.Pix` pixel buffer (rect, dither (Bayer 4×4), line, ellipse, poly, bands, tint, outline, blit, text, text3).
  - `P.tint(x,y,w,h,hex,amtFn,steps)` = lighting by palette shift, quantised + dithered (keeps palettes small).
  - Parallax: a layer of factor f is drawn at `x = -8 - round(camX·f)`; `U.layerW(f)` = needed width,
    `U.wx(X,f)` = layer x of world X, `U.sx(X,f,camX)` = screen x.
  - Floor: `U.buildFloor(y0,y1,yH,texel)` pre-renders each screen row at its depth scale
    `s(y) = (y-yH)/(186-yH)`; `U.drawFloor` shifts every row by `(camX+192)·s` (SNES-style line scroll),
    so seams converge to the vanishing point and row 186 matches fighters exactly (s = 1).
    Objects standing on the floor at row y use factor `U.floorScale(yH, y)`.
- `library.js`, `abyss.js`, `latent.js`, `training.js` — one file per stage:
  `LC.stages.define(id, { music, shadowColor, build(U) → assets, setup(st,A,U) → layers, update, event })`.
  Layers are `{ name, front?, draw(ctx, camX, st), on }`, back to front; drawBack/drawFront walk them.

## API (contract §5.6) + additions
- `LC.stages.init()` builds all four stages + thumbnails (~150–220 ms total in headless Chromium).
- `list()` → `[{ id, music: 'stage.<id>' }]`; `create(id)` → stage `{ update, drawBack, drawFront, event, thumb, shadowColor }`.
- Additions: `LC.stages.thumb(id)` (96×54 without creating a stage), `LC.stages.ids()`, `buildTime(id)`,
  `stage.layers` (viewer toggles), `stage.music`, `LC.stages.U` (helpers).
- Events: library — `hit` (power ≥ 0.6) drops a book + page, lanterns swing; `ko` books/pages/lanterns;
  `roundStart`/`super` lantern flare. abyss — `super` room flicker + holo glitch; `ko` flicker + red LED alarm.
  latent — `hit` ripple ring on the grid at data.x; `super{side}` flares that side's nebula; `ko` double ripple.
  training — `hit` increments the HITS/MAX scoreboard.

## Deviations
- Additive compositing (`'lighter'`) is used for hard-edged, stepped light beams/aurora/caustics
  (SNES colour-math style). No smooth gradients, no AA. The abyss `super` flicker uses one flat
  rgba fillRect (darkening), no gradients.
- Stage `update()` must be called once per tick for ambient animation; drawing with no update shows a frozen frame.

## Dev
- Viewer: `dev/stages-viewer.html` (file:// works): stage picker + thumbs, camera slider/auto-pan,
  zoom, shake, per-layer toggles, dummy fighters in both palettes + HUD/lane guide, event buttons,
  draw-time meter. Magenta = uncovered pixels.
- Shots: `node tools/stages-shots.mjs [ids] [--quick] [--bench]` → `.shots/stages/`.
