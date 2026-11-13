# PLATFORM — notes

## Progress / next steps (truthful as of this pass)
Done and smoke-tested (`npm test`: index.html + dist, real FIGHT CPU-vs-CPU match to result, no errors):
- font bake + runtime (pixel-identical to Chromium's own rendering of the woff2: `npm run font`)
- input (keyboard 2P, gamepads, menu edges, pointer, overrides, rebinding), touch overlay, display, save
- loop + scene stack + transitions (wipe / dissolve / iris / slash), LC.debug + LC_OPTS, build, smoke test
- scenes: boot(+gate), title(+attract demo), menu(+versus sub-menu), select, stage, vs, match(+stub, pause
  with move list / training options), result, ladder, continue, ending, howto (4 pages), options, keys, credits
Next (not done): options list is cramped (12 px rows) — paginate or scroll; portrait-phone polish (bigger
buttons, decorative panel); per-scene screenshot pass after ILLUST icons/title + AUDIO music land;
character select "random" tile; menu tap targets for the result/ladder screens.

## Files (src/platform/, load order = manifest.js)
`../gen/fontdata.js` baked glyphs · `font.js` LC.font · `save.js` LC.save (+settings load/save) ·
`input.js` LC.input · `touch.js` LC.input.touch · `display.js` LC.display · `ui.js` LC.ui kit ·
`art.js` portraits/puppets/logo/banners with fallbacks · `app.js` LC.app loop + LC.scenes ·
`flow.js` match configs, arcade ladder, post-match routing · `stub.js` stub match · `debug.js` LC.debug ·
`scenes/*.js` one file per scene group.

## How it works
- **Font**: `tools/platform-bake-font.py` samples each CFF outline at pixel centres (1 px = 100 units,
  non-zero winding) → 1-bit bitmaps, tight bboxes, kerning pairs, plus the font's two GSUB alternates
  (centred `:` between digits, joined `——`) as private-use glyphs. 7554 chars: ASCII, GB2312 (all),
  extras, every non-ASCII char found in `src/**`. Line box = `size` px (baseline at size-2). Missing
  glyphs borrow from another size, else draw a box and `console.warn` once. Rendering: strings are
  rasterised once (text + 8-neighbour outline + 1 px shadow) into an LRU cache (900 strings / 3 Mpx);
  `cache:false` draws glyphs from a tinted atlas per (size, colour).
- **Display**: canvas CSS size = 384·s/dpr with integer device scale s and `image-rendering: pixelated`.
  Touch layouts: portrait = game on top, controls below; landscape = controls in the side bars (shrinks
  one step if that frees ≥118 css px per side), else translucent bottom-corner overlay. CRT = a second
  canvas drawn once per resize.
- **Loop**: 60 Hz fixed step, accumulator with vsync-jitter snap, ≤4 catch-up ticks, render only after a
  tick, pause while hidden (and auto-open the pause menu in human matches on return).
- **Scenes**: `LC.scenes.define(name, factory)`; `go` (with transition; input locked meanwhile),
  `push`/`pop` overlays. Scene exceptions are caught, logged to `LC.debug.errors`; >3 → back to menu.
- **Audio**: unlocked inside the real gesture event (`LC.input.onGesture`), never from the loop.
  PLATFORM calls `ui.forgetMusic()` when a match starts because FIGHT owns music until `finished`.

## Contract additions / deviations
- `LC.font.draw` returns the drawn width; extra opts `reveal` (typewriter), `cache`, `alpha`.
  `measure().w` is the ink-tight width (no trailing advance). `lineHeight(size, lineGap = 2)` = size + gap.
  Extras: `LC.font.wrap` (CJK kinsoku), `LC.font.length`, `has`, `stats`, `clearCache`, `DATA`.
- `LC.input`: extras `menuFor(i)` (per-player menu edges, used by 2P select), `pointer` (game-space
  taps/clicks), `onGesture(fn)`, `setOverride`, `lock`, `bind/resetKeys/captureNext`, `pads()`,
  `touch` (overlay). Player state also carries `start`. Macro keys: throw = L+M, super = H+S.
  Gamepad: X=L, Y=M, B=H, A=S, LB/LT throw, RB/RT super, Start pause; menus A=ok B=back.
  Duo mode: 1 pad → 2P; 2+ pads → pad0 1P, pad1 2P. P2 throw/super keys (`M`/`'`, Numpad 4/6) are additions.
- `LC.debug`: extras `initTimes`, `scenes()`, `shot()`. `LC.debug.goto('match', params)` accepts either a
  full config or flat boot-style params (`p1`, `pal1`, `ctl1`…).
- `LC.ui.*` helpers are public for other modules if useful (panel, bar, hints, notation, backdrop…).
- Fallbacks: ILLUST canvases that are blank (placeholders) are detected and replaced by PLATFORM art.

## Known issues
- With FIGHT absent, the stub match is crude by design (attack buttons chip HP; keys 1/2/0 decide rounds).
- Options screen: 14 rows at 12 px pitch is tight. Character select has no "random" tile.
- The fullscreen option in Options runs outside the gesture event; it works in Chrome (transient
  activation) but may be refused elsewhere — the DOM button is the reliable path.
