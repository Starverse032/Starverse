# FX — `LC.fx` notes

## Status (truthful)
- All §5.4 names exist and render: 33 required spawns + 4 extras, 10 sprites. Zero console errors
  (every effect × palette × facing exercised by a Playwright check).
- Hits, blocks and the two supers (beam and whale) went through visual review rounds. Most
  other effects had one review pass (v1 quality).
- Perf (headless Chromium): init ≈ 390 ms. With ~325 live particles, `draw` (back+front) has a
  median of 0.3 ms and a p90 of 0.4–0.7 ms. The first draw of each baked canvas can cost a
  one-off upload hitch.

## Files
`pix.js` software rasteriser (Buf, poly/ray/star/ring/ellipse, outline, Scale2x, RotSprite-lite
rotate, `I.anim` frame baking + mirrored sheets) · `core.js` pool/kinds/API/schemes/PRNG ·
`glyphs.js` 3x5 font, 7x7 五/七, R1, glyph + verse-line particles · `generic.js` hits/blocks ·
`generic2.js` dust/rings/throws/KO/meter/charge · `claude.js` + `claude-sprites.js` ·
`deepseek.js` + `deepseek-sprites.js` · `whale.js` · `screen.js`.
Tools: `dev/fx-viewer.html` (+`fx-viewer.js`), `tools/fx-sheet.mjs`.

## How it works
- Every frame of every effect is drawn once in `init()` by code into a `Buf` (exact pixel-centre
  rasterisation, no AA), then turned into a sheet canvas plus a per-frame mirrored sheet. At
  runtime the code only calls `drawImage` at integer coordinates and `fillRect` for particles.
- Pool: 400 preallocated particles. The `live` array keeps spawn order, which is also draw order.
  When the pool is full, the oldest expendable particle (`pri 0`) is recycled. Emitters that run
  out of slots during `update` get a dummy instead. Steady state allocates nothing.
- Kinds: anim, dot, spark (streak), drop (stretches, splats on the floor), chip (bounces),
  twinkle, ribbon (joins consecutive trail spawns), emitter, glyph, textline, shard, page, bubble.
- Palettes: `I.scheme(char, pal)` derives ramps from `LC.PAL`. Claude: `light` = white → accent →
  deep, `gold` = metal, `paper` = cloth1 (so palette 1 gets dark-mode pages). DeepSeek: `water` =
  white → accent → deep (so palette 1 gets coral-pink water), `blue`/`belly` for the whale.
  Generic effects use neutral ramps; some accept `opts.char` to tint.
- Own PRNG (`LC.fx.seed(n)` for reproducible strips); sprites use a stateless `I.hash`.

## Adding an effect
```js
I.onInit('mine', function () { A.mine = I.anim(w, h, frames, ox, oy, function (buf, f) { /* draw frame f */ }); });
I.def('family.name', function (x, y, O) { I.anim1(A.mine, x, y, O.facing, I.FRONT, 1); I.spark(...); }, { desc: '…', use: '…' });
```
Sprites: `I.defSprite(name, { draw(ctx, sx, sy, t, o), info: { duration, bbox }, desc, use })`.
Add the file to `manifest.js`. Check it with `node tools/fx-sheet.mjs family.name --bg=warm,blue,dark,light`.

## Viewer and strips
- `dev/fx-viewer.html` (file://): click a name to spawn it or show a sprite. Click the canvas to
  move the marker. Controls: backgrounds (mid / warm / blue / dark / light), zoom, speed ½–⅛,
  pause/step, loop, power, facing, palette, char, index, beam length/phase, settings.flash,
  stress, live count, draw ms.
- `node tools/fx-sheet.mjs [filters…] [--bg=a,b] [--scale=3] [--frames=0,1,2] [--cols=8] [--cell=w,h]
  [--opts='{"palette":1}'] [--bench]` writes `.shots/fx/<name>.png` (frames as columns,
  backgrounds as rows).

## Contract notes / additions
- Added opts: `char` (tints hit.special, ring, ring.ground, sparkle, meter.full, super.charge,
  screen.superBg), `layer` ('back'|'front' override). Sprite opts: `angle` (claude.spark travel
  angle), `u`, `cx`/`cy` (superBg focus), `color`.
- Extra spawns: `dust.skid`, `ring.ground`, `sparkle`, `deepseek.splash`.
- Extra API: `LC.fx.describe(name)`, `LC.fx.stats()`, `LC.fx.resetPeak()`, `LC.fx.seed(n)`.
- `spriteInfo('deepseek.whale')` adds `frames[t] = {x,y,w,h}` (facing right; for facing -1 mirror
  it as `x' = -(x+w)`; `w = 0` when not hittable), `events {emerge:3, apex:27, crash:50}`, `crashX: 128`.
- Conventions: hit/block `facing` = the attacker's facing (the direction of the blow).
  `claude.guardrail` and `claude.guardCatch` are both positioned at the fighter origin, not the
  barrier.

## Usage / timing for FIGHT
| name | where / when |
|---|---|
| `hit.light/medium/heavy` | contact point, facing = attacker, on the first hit-stop frame (frame 0 holds during hit-stop; it is the brightest frame). 8/12/16f |
| `hit.special` | special-move hits, pass `char`. 18f |
| `hit.counter` | counter hits, instead of the normal spark. 22f |
| `block.light` / `block.heavy` | contact point on block (heavy for H / specials / supers). 10/14f |
| `dust.jump` / `dust.land` / `dust.dash` / `dust.down` / `dust.skid` | origin on take-off / landing (power 0.3 for small hops) / first dash frame (facing = dash direction) / body hits the floor / every ~6f of push-back slide |
| `throw.tech` | midpoint between the chests. `throw.slam`: the victim's floor landing point |
| `ko.burst` | final contact point on KO (52f at 2 ticks per frame) + sprite `screen.koFlash` for 24f |
| `meter.full` | `center` anchor when the gauge hits 100 |
| `super.charge` | chest at super start (keep calling `fx.update` during the flash), with `char` |
| `screen.superBg` | after stage.drawBack during the flash, `{char, palette, cx, cy}` = attacker chest on screen |
| `claude.sparkCast` | `muzzle` on the first active frame. Sprite `claude.spark` each frame of the projectile (`angle` for airSpark). `claude.sparkHit` where it hits / is blocked / clashes |
| `claude.sonnetTrail` | every 2nd frame of rise+fall at `weapon` |
| `claude.haikuSlash` | `hip` anchor, first frame of hit1/hit2/hit3 with `index` 0/1/2 |
| `claude.guardrail` (sprite) | fighter origin during the hold. `phase:'end'` + t since end for a 6f dissolve. `claude.guardCatch` at the origin on a catch |
| `claude.book` + `claude.beam` | book in front of the chest. Beam from the muzzle: charge (power = progress) → fire (grow `length` ~40 px/f) → fade (power 1 → 0). `claude.beamHit` on each hit tick. `claude.pages` at super start |
| `deepseek.waveCast` | `muzzle` (floor) on the first active frame. Sprite `deepseek.wave` at the projectile (base centre). `deepseek.waveHit` on hit/block |
| `deepseek.breachTrail` / `deepseek.diveTrail` | every frame at `weapon` (consecutive spawns join into a ribbon) |
| `deepseek.poolIn` | origin at the sink start + sprite `deepseek.pool` (power 0 → 1 to open). `deepseek.poolOut` at the exit point on the diveOut start |
| `deepseek.chainHit` | each chain hit, `index` 0/1/2 |
| `deepseek.whale` (sprite) | floor point in front of her, t 0..59, hitboxes from `frames`. Spawn `deepseek.whaleSplash` at `x + facing*128, GROUND_Y` on t = 50 |
| `deepseek.bubbles` | ambient flourishes |

## Known weaknesses / next
- Medium-priority effects (dust, meter, tech, pages, bubbles, trails) only had one look.
- Some palette-1 colours were not reviewed on every stage.
- The whale has a single body pose (no tail flex or blink).
- The guardrail panel silhouette is a bit blobby.
- The beam glyph text is decorative at ×1.
- Possible next steps: pre-warm the canvas uploads, run a light-stage contrast pass for pale effects,
  and add whale pose variants.
