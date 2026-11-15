# FX — `LC.fx` notes

## Status (truthful)
- All CONTRACT §5.4 names exist and render, plus the V2 additions below: 40 spawn effects and 15 sprites.
  An automated check (every effect × palette × facing × char, every sprite × phase) gives zero console
  errors.
- V2 (CONTRACT-V2 §V2.4) work is listed in "V2 progress" below. The integration guide for FIGHT is at the end.
- Perf (headless Chromium, software 2D): the particle stress test (~360 live) has a `draw` median of
  0.3 ms and a p90 of 0.5–0.6 ms. Full super compositions (backdrop + beam + book, or backdrop + whale
  + tidal) have a median of 0.1–0.2 ms and a p90 of 0.2–0.4 ms. `init` takes about 1.1 s headless
  (v1 took 0.4 s). About 590 baked canvases are pre-warmed at the end of `init`, so the first draw has
  no upload hitch. The remaining max spikes (7–15 ms) come from the first draw onto a freshly created
  canvas in the benchmark.

## Files (manifest order)
`pix.js` software rasteriser (Buf, poly/ray/star/ring/ellipse, outline, Scale2x, RotSprite-lite, `I.anim`
frame baking + mirrored sheets; `I.canvases` registry for pre-warm) · `core.js` pool/kinds/API/schemes/
PRNG/pre-warm · `glyphs.js` 3x5 font, 7x7 hanzi, glyph + verse-line particles · `generic.js` v1 hit.light/
medium (+ unused v1 heavy bakes) · `generic2.js` dust/rings/throws/meter/charge · `claude.js` cast/sparkHit/
sonnetTrail/beamHit/pages/shards · `claude-sprites.js` (only `I.mirrored` now) · **`claude-super.js`**
beam v2 + book v2 · `deepseek.js` crowns/bubbles/waveCast/waveHit/breachTrail/poolIn/whaleSplash ·
`deepseek-sprites.js` pool (+ v1 wave bake, unused) · **`whale.js`** whale v2 + tidal · **`screen.js`**
full-screen overlays · **`backdrop.js`** superBackdrop · **`specials.js`** V2 specials · **`hits.js`**
V2 hits/blocks/KO. A later file overrides an earlier definition with the same name.
Tools: `dev/fx-viewer.html` (+`fx-viewer.js`), `tools/fx-sheet.mjs`.

## How it works
- Every frame of every effect is drawn once in `init()` by code into a `Buf` (exact pixel-centre
  rasterisation, no AA), then turned into a canvas. At runtime the code only calls `drawImage` at
  integer coordinates and `fillRect` (particles, runtime rays). Mirroring uses a pre-baked mirrored sheet
  or `I.mirrored` (an exact −1 scale around an integer x). Text is never mirrored.
- Pool: 400 preallocated particles, spawn order = draw order, the oldest expendable one is recycled when
  the pool is full, and steady state allocates nothing.
- Palettes: `I.scheme(char, pal)` derives ramps from `LC.PAL`. Claude: `light` (white → accent → deep),
  `gold` (metal), `paper` (cloth1), `ink` (cloth2), `book` (the new `book` leather slot), `seal`.
  DeepSeek: `water`/`foam`/`glow` (accent), `blue` (navy dress), `belly`.
  The whale uses the `hair[0]` / `ui` / `hair[1]` / `hair[2]` blues for palette 0. The navy-grey `fin`
  ramp would disappear against the deep-sea backdrop. Palette 1 uses `fin` (aqua). The belly is white.
- Own PRNG (`LC.fx.seed(n)`); sprites are pure functions of `t` (stateless hashes).
- `LC.settings.flash === false`: no white-outs, softened tints, and fewer lines on every `screen.*`.

## Names
Spawn (40): `hit.light/medium/heavy/special/counter`, `block.light/heavy`, `dust.jump/land/dash/skid/down`,
`ring`, `ring.ground`, `sparkle`, `throw.tech/slam`, `ko.burst`, `meter.full`, `super.charge`,
`claude.sparkCast/sparkHit/sonnetTrail/beamHit/pages/haikuSlash/guardCatch/`**`sonnetPillar`**,
`deepseek.waveCast/waveHit/breachTrail/poolIn/whaleSplash/bubbles/splash/chainHit/diveTrail/poolOut`,
**`deepseek.breachCrescent`**, **`deepseek.geyser`** (poolOut = alias).
Sprites (15): `claude.beam`, `claude.book`, `claude.guardrail`, `claude.spark`, `deepseek.wave`,
`deepseek.pool`, `deepseek.whale`, **`deepseek.tidal`**, `screen.superBg`, `screen.speedLines`,
`screen.koFlash`, **`screen.superBackdrop`**, **`screen.superFinish`**, **`screen.koBackdrop`**,
**`screen.impact`**. Bold = new in V2. Upgraded in V2: beam, book, whale, guardrail, guardCatch, spark,
wave, haikuSlash, chainHit, diveTrail, poolOut, hit.heavy/special/counter, block.light/heavy, ko.burst,
superBg, speedLines, koFlash.

## Viewer and strips
- `dev/fx-viewer.html` (file://): click a name to spawn it or show it, and click the canvas to move the
  marker. Controls: background, zoom, speed, pause/step, loop, power, facing, palette, char, index,
  beam length, phase (auto/charge/fire/fade/end/out/counter), settings.flash, stress. Use `char` for
  `screen.superBackdrop` / `superFinish`.
- `node tools/fx-sheet.mjs [filters…] [--bg=a,b] [--scale=3] [--frames=0,1,2] [--cols=8]
  [--cell=w,h,ox,oy] [--x=originX] [--opts='{"char":"deepseek"}'] [--tag=t] [--dummies] [--bench]`
  writes `.shots/fx/<name>[-tag].png`. Full-screen sprites use the whole screen.
  Whale example: `node tools/fx-sheet.mjs deepseek.whale --x=60 --cell=384,216,132,186 --scale=1 --bg=blue`.
  `--bench` prints init/bake times, the particle stress test, and super-composition draw times.

## V2 progress / next steps
Done and reviewed in strips (both palettes, both facings for the full-screen pieces):
1. `screen.superBackdrop` (claude study / deepseek deep sea), `screen.superFinish`, `screen.koBackdrop`,
   `screen.impact`. `superBg`, `speedLines` and `koFlash` are upgraded (superBg is pre-baked at 600×340
   per char, and `opts.color` is ignored when `char` is set, so no lazy bake happens at the first super).
2. `claude.beam` v2 (80 px), `claude.book` v2 (opens, then fans its pages), `deepseek.whale` v2 (300 px,
   flexes), `deepseek.tidal`.
3. `claude.sonnetPillar`, `claude.haikuSlash` v2, `claude.guardrail` v2 + `guardCatch`, `claude.spark` v2,
   `deepseek.wave` v2, `deepseek.breachCrescent`, `deepseek.geyser` (+ poolOut alias), `chainHit` v2,
   `diveTrail` v2.
4. `hit.heavy/special/counter`, `block.light/heavy`, `ko.burst` v2.
5. Pre-warm, viewer phase options, the fx-sheet `--x` flag, `--bench` super numbers, dead v1 bakes
   removed (claude beam/book/spark/guardrail/haiku, deepseek column).

Next / known weaknesses:
- `init` takes about 1.1 s headless (specials ≈ 250 ms, backdrop ≈ 180 ms, whale ≈ 170 ms,
  screen ≈ 110 ms). Options: share palette-independent geometry, or bake palette 1 in idle time.
  generic.js still bakes unused v1 heavy/special/counter/block anims (≈ 40 ms).
- Memory: whale poses (~45 per palette) plus the 600×340 radial images come to roughly 30 MB of canvas.
- `hit.counter` crackle lines look a bit like wires. The `claude.spark` petal trail is plain.
- The claude backdrop is busy around the fighters' lane. It is dimmed, but check it with real fighters.
- `deepseek.tidal` is a simple breaker shape. Its spray wall is particle dots only, and the step where
  it meets the flood is still faintly visible.
- Not reviewed against the four real stages (only the viewer mock backdrops), and not tested with the
  new 100 px rig sprites.

## GPT progress / next steps (truthful, updated as work lands)
- [x] 1. `char:'gpt'` colour scheme: `core.js` `schemeFor('gpt')` (`light`/`glow`/`gold`=platinum/`scale`/`wing`/
  `night`/`deep`), plus generic roles on every scheme (`main` = claude.light | deepseek.water | gpt.light,
  `twk` = twinkle ramp), `I.CHS`, `I.hasChar`. generic2 (ring, ring.ground, sparkle, meter.full,
  super.charge), hits (hit.special) and screen (burstCols, superBg, superFinish, koBackdrop, impact) now
  bake/tint per `I.CHS`. Checked in strips: claude/deepseek output unchanged; gpt teal on dark/warm/light.
- [ ] 2. super: `screen.superBackdrop` gpt (night sky + attention grids), `gpt.attention`
- [ ] 3. specials: `gpt.breath` sprite + `breathCast/riseTrail/callSlam/roarRing/clawHit/scales`
- [ ] 4. strips / review / viewer / bench
- [ ] 5. "GPT integration" section below

## V2 integration (for FIGHT)
Coordinates: `spawn` uses world coordinates, `drawSprite` uses screen coordinates
(`sx = worldX − camX`). Bboxes are relative to the origin, facing right. For facing −1 use
`x' = −(x + w)`. Composition (CONTRACT §6) with the V2 slots:
```
[A] background: stage.drawBack  — or, while active, ONE of: screen.superBackdrop | screen.superFinish | screen.koBackdrop
[B] screen.superBg (super flash only) / screen.impact (8f after heavy hits & counters)
[C] engine "back" sprites: deepseek.whale
fx.draw(ctx, camX, 'back')
fighter shadows → fighters
[D] engine "front" sprites: projectiles (claude.spark, deepseek.wave), claude.guardrail, claude.beam → claude.book, deepseek.tidal
fx.draw(ctx, camX, 'front')
stage.drawFront (skip it while [A] is a super/KO backdrop)
[E] screen.koFlash (24f) → HUD → cut-in → banners
```
Intro/outro frames of `screen.superBackdrop` (t < 8, and `phase:'out'`) only cover part of the screen:
draw `stage.drawBack` first on those frames.

### Claude super 巨著·万言长卷 (startup 6 → flash freeze → cast 10, active 40, recovery 30)
| when | what |
|---|---|
| flash (freeze) | `screen.superBg` at [B] `{char:'claude', palette, cx, cy}` (chest), spawn `super.charge` at the chest (keep `fx.update` running) |
| cast f0 (= c0) | [A] `screen.superBackdrop` `{char:'claude', palette, facing}` t = 0 (8f page-wipe from her side; draw the stage under it for t < 8). `claude.book` at the book point in front of her chest, t = 0 (opens over 12f). Spawn `claude.pages` at the book on c0 + 4 |
| cast f0–9 | `claude.beam` `{phase:'charge', power:(f+1)/10, length:0}` at the muzzle (the charge draws a target line 360 px long) |
| active f0–39 | `claude.beam` `{phase:'fire', power:1, length:min(420,(f+1)*40)}`, plus `claude.beamHit` at the victim's chest on each hit tick. The leading edge, spearhead and ragged front show until length > 420 |
| recovery f0–11 | `claude.beam` `{phase:'fade', power:1 − f/12}` (80 → 60 → 40 → 22 px, then wisps). Stop drawing `claude.book` after f11 (or fade it with `alpha`) |
| recovery f12–19 | `screen.superBackdrop` `{phase:'out'}` t = 0..7 over the stage, then the stage only |
| beam data | `spriteInfo('claude.beam')`: `halfHeight: 40` (v1 was 22), `levels: [40,30,20,11]`, `bbox {x:0,y:-40,w:384,h:80}`. The visual is 80 px tall: widen the beam hitbox if it should match |

### DeepSeek super 深度思考·鲸落 (startup 6 → flash → cast 8, active 44, recovery 34)
| when | what |
|---|---|
| flash | `screen.superBg` `{char:'deepseek', …}`, `super.charge` |
| cast f0 (= c0) | [A] `screen.superBackdrop` `{char:'deepseek', palette, facing}` t = 0 (water rises from the floor over 8f; stage under it for t < 8) |
| c0 … c0+59 | [C] `deepseek.whale` at (her screen x + facing·52, GROUND_Y), `{facing, palette}`, t = 0..59. Do NOT hard-code 50 / +128 any more: read `spriteInfo('deepseek.whale')` → `events {emerge:3, apex:27, crash:46}`, `crashX: 194` (both are computed at init) |
| hitboxes | `frames[t]` = `{x,y,w,h}` rel. the whale origin, facing right, clipped above the floor; `w = 0` → no box. Samples: t4 (-8,-31,58,31) · t12 (-3,-169,129,169) · t20 (-61,-186,263,186) · t28 (-65,-160,301,160) · t36 (-37,-182,290,149) · t44 (-7,-163,271,163) · t48 (32,-101,216,101) · t52 (69,-23,106,23) · t ≥ 56 none |
| t = events.crash | spawn `deepseek.whaleSplash` at (whaleOriginX + facing·crashX, GROUND_Y) and start [D] `deepseek.tidal` there (t = 0..47, `{facing, palette}`) |
| tidal hitboxes | `spriteInfo('deepseek.tidal').frames[t]` rel. the crash point: the crest (56 px wide, up to ~80 tall) travels t0 (-42,-14) → t12 (44,-79) → t24 (154,-76) → t36 (255,-36); none from t 38. It may be cut after t 40 (foam only) |
| recovery f26–33 | `screen.superBackdrop` `{phase:'out'}` t = 0..7 (water drains), then the stage |

### Super KO / KO
- On the KO hit: spawn `ko.burst` at the contact point. Draw `screen.koFlash` at [E] for t = 0..23.
- From koFlash t = 5 until the body lands, draw at [A] (instead of the stage):
  - KO by a super: `screen.superFinish` `{char: winner, palette, cx, cy}` (cx,cy = KO point on screen;
    frozen, a white pop for t < 3).
  - Any other KO: `screen.koBackdrop` `{cx, cy}`. Optional `char: winner` tints it. It is animated,
    and `t` can be render frames.
- Leave out `stage.drawFront` while either of them is shown.

### Heavy hits / counters
- `screen.impact` at [B] for 8 frames from the hit, `{cx, cy}` = the contact point on screen.
  Use `phase:'counter'` for counters (red tint). `char` is optional and tints it. Hold `t` during hit-stop.
  Use it on H hits, launchers, counters and special hits that knock down. Do not use it on every hit.
- `hit.heavy` (22f of particles), `hit.counter` (22f) and `hit.special` (`char`) are bigger (≈60–76 px).
  Spawn them at the contact point, facing = attacker, as before.
- `block.light` / `block.heavy` are crescent ")" shields that bulge toward the attacker (facing =
  attacker, as before).

### Specials (new / changed calls)
| name | call |
|---|---|
| `claude.sonnetPillar` | spawn at her ORIGIN (floor) on the first rise frame of `sonnet`, facing = hers. Back layer, 26f column (~26×190) + verse lines (≈38f). Keep `claude.sonnetTrail` at `weapon` every 2nd frame |
| `claude.haikuSlash` | unchanged call (`hip` anchor, `index` 0/1/2 on hit1/2/3). Reach: index 0 ≈ 110 px rising, 1 ≈ 150 px sweep, 2 ≈ 230 px falling slash (from 34 px behind to 192 px ahead of the anchor). Seals are 15 px vermilion stamps |
| `claude.guardrail` | unchanged call (at the ORIGIN, phase 'end' for the 6f dissolve). bbox is now `{x:26, y:-102, w:36, h:96}` (was 13,-60,26,58) |
| `claude.guardCatch` | unchanged call (ORIGIN). Matches the new barrier |
| `claude.spark` | pass `power`: 0.3 = L (~22 px), 0.6 = M (~28 px), 1 = H (~34 px, the default). `angle` works as before. bbox for H `{x:-15,y:-15,w:30,h:30}` |
| `deepseek.wave` | unchanged call (base centre on the floor). Now ~44×40: bbox `{x:-24,y:-40,w:46,h:41}`; rises out of the floor during t 0–2 |
| `deepseek.breachCrescent` | spawn at her ORIGIN on the first rise frame of `breach`, facing = hers (back layer, 14f crescent that sweeps up over her, ≈31f with drops). Keep `deepseek.breachTrail` at the tail tip |
| `deepseek.geyser` | spawn at the exit point (floor) on the first frame of `diveOut` (`deepseek.poolOut` does the same). The column (~170 px, 26f) is in the back layer, the splash in front |
| `deepseek.chainHit` | unchanged call (`index` 0/1/2), bigger burst + spray + ring |
| `deepseek.diveTrail` | unchanged call (every active frame of `diveKick` at `weapon`), thicker ribbon |
