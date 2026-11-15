# PLATFORM — notes

## Progress / next steps (truthful as of this pass)
Done and smoke-tested (`npm test`: index.html + dist, real FIGHT CPU-vs-CPU match to result, no errors; roster checks: every char's arcade ladder, GPT pick via real select input, GPT ladder/VS/result/ending/how-to shots, GPT CPU match when FIGHT+RIG support her, else logged skip + degraded-match check):
- font bake + runtime (pixel-identical to Chromium's own rendering of the woff2: `npm run font`)
- input (keyboard 2P, gamepads, menu edges, pointer, overrides, rebinding), touch overlay, display, save
- loop + scene stack + transitions (wipe / dissolve / iris / slash), LC.debug + LC_OPTS, build, smoke test
- scenes: boot(+gate), title(+attract demo), menu(+versus sub-menu), select, stage, vs, match(+stub, pause
  with move list / training options), result, ladder, continue, ending, howto (4 pages), options, keys, credits
Next (not done): options list is cramped (12 px rows) — paginate or scroll; portrait-phone polish (bigger
buttons, decorative panel); per-scene screenshot pass after ILLUST icons/title + AUDIO music land (and
GPT art: re-shoot select/ladder/vs once ILLUST/RIG know her); menu tap targets for the result/ladder screens.

## Roster (three fighters, V2.1)
Nothing in PLATFORM names a fighter except cosmetic fallbacks; everything iterates `LC.CHARS`.
- `flow.js`: `app.other(ch)` = first rival; `app.rivalsOf`, `app.randomChar(except)`, `app.homeOf` (prefers
  `LORE.homeStage`), `app.arcadeStep(A, k)` resolves a ladder step (`foe: rival1|rival2|mirror`, legacy `rival`;
  `stage: foeHome|<id>`, legacy `rivalHome/ownHome`; mirror forced to the other palette) — the ladder screen
  and `arcadeFightParams` both use it. Taunts: mirror → `arcadeTaunt.mirror[char]`, else boss →
  `arcadeTaunt.boss[foe]`, passed as `introLines`.
- Feature detection: `app.fightSupports(ch)` (`LC.fight.chars[ch]`, else non-empty `getMoveList`) and
  `app.rigSupports(ch)` (`LC.rig.hasAnim(ch,'idle')`). `ui.puppet` uses the fallback puppet when RIG has no
  idle for ch and switches to it if a rig puppet throws; `ui.portrait` skips ILLUST for chars absent from
  `LC.illust.ART` (fallback busts are tagged `lcFallback`; tiles crop them lower). FIGHT itself substitutes
  an unknown char, so a GPT match plays (as a stand-in) without errors until FIGHT ships her.
- Select: tiles in a grid (`COLS = ceil(sqrt(n+1))`, 2×2 for three + 随机) centred between the live
  puppets (x 128 / 256); ←→ cycles all tiles with wrap, ↑↓ palette. Random rolls a visible preview every 24
  frames and re-rolls on lock. Cursor tags sit above the top row / below lower rows.
- How-to: two fixed pages + one move-list tab per char (tab width shrinks with roster size; long zh names
  fall back to the latin name). Pause move list ←→ cycles `LC.CHARS`. Move lists from
  `LC.fight.getMoveList` (cached only when non-empty) else `LORE.moves`.
- Menu showcase cycles all fighters; attract demo picks any two (25% mirror).

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
- Options screen: 14 rows at 12 px pitch is tight.
- Select: DeepSeek's tail on the right live puppet slightly overlaps the inner edge of the P2 bust; the
  latin name "DEEPSEEK" is ~1 px wider than its 38 px tile.
- GPT fallback bust/puppet are crude placeholders until ILLUST/RIG add her.
- The fullscreen option in Options runs outside the gesture event; it works in Chrome (transient
  activation) but may be refused elsewhere — the DOM button is the reliable path.
