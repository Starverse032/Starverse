# RIG — notes

## V2 infra changes (2026-11-14, Claude animator) — all backward compatible
- `raster.js`: render buffer is now **320×256, origin (160, 204)** (was 200×184 / 100,156) — room for 104-px
  fighters, long hair, skirt flare, wide smears, lying poses. Everything reads `I.BW/BH/OX/OY`, nothing else to do.
- `raster.js` `P.end({ ring: colIndex })`: optional exterior outline colour (e.g. `I.col(M.glow, 3)` for glowing
  props / smears). Default unchanged (palette outline + inner deep-tone rule).
- `skel.js`: new pose channels (default 0, ignore them if unused): vector `bk`; scalars `book`, `bko`, `tw`, `hem`.
  Solved into `sk.bk`, `sk.book`, `sk.bko`, `sk.tw`, `sk.hem`. Claude uses them for the book (pos/angle/open), torso
  twist and hem flare; free for DeepSeek too (they are NOT in the core signature: add them via `sigExtra`).
- `core.js`: signature buffer 2048 ints; optional per-character hook `C.sigExtra(sk, s, n) -> n` to add extra integer
  state that should trigger a re-render.
- `chars/common.js`: `H.hand(p, at, ang, shape, skin, glove, table)` — optional own stamp table
  (`{ id, legend, shape: { a0, p0, a45, p45 } }`) for bigger V2 hands; `H.smear2(p, sm, mat, opts)` = shaped smear
  (tapered crescent, deep trailing → bright leading tones, bright rim + dark inner edge). Old `H.smear` unchanged.
- `dev/rig-sheet.html` cells are 300×240 with the origin at (150, 200); `dev/rig-viewer.html` view 320×220, ground 196.
  `tools/rig-sheet.mjs` usage unchanged.
- `raster.js`: opt-in `painter.fastTone = true` (set it in your `draw`, reset after): per-edge bbox early-out in
  polygon shading (~20 % faster draw; differs from the old shading only inside concave polygons).
- `secondary.js`: opt-in chain option `cvel` (0..1): fraction of length-constraint/limit corrections NOT turned
  into velocity (stops long hair whipping after pose snaps). Default 0 = old behaviour.
- Per-character proportions were already per character (`C.body`, `C.height/crouchHeight/width`); nothing in the
  shared code assumes the old 70-px size any more.

## V2 progress / next steps (Claude) — kept current for restarts
- V2 body DONE (`chars/claude.js`, `chars/claude-art.js`): 104 px (head top -104, crouch ≈ -70, width 26), Victorian
  layered dress per the reference (capelet + gold edge/emblem, jabot + black cravat + flower brooch, wide black corset
  belt with gold buttons/chain, cream pleated skirt with a black gold-bordered side panel under an orange-lined cream
  drape, orange front sash (chain) + tassel, black hip bow + flower, frilled hem, cream heeled lace-up boots, black
  tights), knee-length straight hair (9-link chain kept behind the back silhouette), sunburst flower on a black bow +
  tassel, leather book 「宪章」, quill of light, V2 hand stamps, shaped smears (`H.smear2`). Palettes 0 and 1 checked.
- Skirt = rib model (`skirtGeo`): front/back ribs pushed by knees/shins/boots, drape over a raised knee, hem = sagging
  quadratic, floor clamp unless `air: true`; frame turns with the body when lying (|lean| > 30).
- ALL §3.3 anims are V2-authored (no V1 data left) and reviewed in sheets at least once: base set, normals, specials,
  super, throws, intro/win/lose. Segment ids/frame counts unchanged (placeholders.js check passes).
- Reach (weapon anchor, px) 5L 41 · 5M 60 · 5H 72 · 2L 42 · 2M 62 · 2H 70 · jL 37 · jM 46 · jH 59 (targets met ±1);
  spark muzzle (40,-78), airSpark (36,-56), haiku 58/54/70, guardrailHit 44, super muzzle = book centre (34,-82).
- Perf: worst-case draw (re-render every frame) ≈ 1.0 ms; anchors ≈ 4 µs; init ≈ 1.2 ms.
- Polish pass (2026-11-15), all reviewed in sheets (Claude-only files touched):
  - getup: pose flag `drape: true` (keys 6, 12) → `skirtGeo` drapes the front over the highest knee down to the
    floor in front of the ankles and pools the back behind her; f12 hip raised so the back boot stays above the floor.
  - launch: `tail` (deg, skirt + hair trail angle; hair gets ×1.3 in `air` poses, ×0.4 otherwise) and `arch`
    (0..1 billow: bell opens, ribs shorten and curl, hem lifts with a ripple) — Claude now uses these two existing
    numeric channels; keyed per launch key so the skirt/hair billow and trail with the tumble.
  - down: hair `limit` — when lying face up (lean < -60, pelvis near the floor) the hair is pulled onto the floor,
    fanned out past the head; settles in ~2 f even after an airborne launch (cvel keeps it from whipping).
  - walkF/walkB: `gait()` extra in `G.walk` (speeds/feet/foot lock unchanged): pose flag `peek` → narrower back
    bell, hem raised ~4 px with its front edge kept ~4 px behind the leading toe, and the leading planted boot's
    toe drawn over the hem (`drawBootTip`); `tail` hem swing against the stride, bob 1.8/1.5, lean + head
    counter-sway, shoulder lift on the passing frame, bigger arm swing; hair does not stream while walking.
  - quill start-ups (5H 2H jH haiku sonnet): hand crosses to the book (it flicks open, bko 0.35), then a short
    streak of light (`ql: 0.45` = drawn-out length, drawn as a bare glowing streak trailing back to the book) is
    pulled out, then the full quill unfurls into the wind-up. Active frames / reach unchanged.
  - intro: reads → glances up → snaps the book shut (shoulder jolt, skirt kick, hair flick) → hands carry it to
    the back hip → small smile → stance. win: book to chest, front hand straightens the hair flower, happy eyes,
    swaying loop (capelet/hair follow). lose: slumped, book hugged in both arms, head hanging, slow sigh loop.
- Rough / next: crouch-based poses (2H, sonnet start-up) show a thin skirt plate on the floor behind her (back rib
  clamped flat); the back-hip book handover in the intro still pops a few px; walk boot tips are cream-on-cream
  (readable but subtle).

## Progress / next steps (V1, historical)

- DONE: full §5.3 API; both characters render (v1 look); EVERY §3.3 anim is authored for both (no aliases in use;
  `fillPlaceholders()` still guarantees names and logs an error if authored segments differ from the table in
  `anims/placeholders.js`). Viewer + sheet tool done. Determinism verified (anchor hash identical across runs).
- Polish done: identity pass (faces, hair, palettes), walks, hitHigh, down/getup, guards, launch, Claude 5H, DS breach/5M.
- Polish pass 2 step 1 DONE (costume: skirt light/tights dark A-line + swing, capelet layer + shadow, tie/cuffs/boot trim,
  DS hood/stripes/pocket, stamp hands).
- Step 2 DONE: normals — held wind-up + snap strike + held impact; reach measured at the weapon tip: Claude 5L/5M/5H
  31/46/54, DeepSeek 23/37/44 (guide 30/46/54, 24/38/44). Fist/foot `weapon` = knuckles/toe tip.
- Step 3 DONE (first pass): spark = draw-back → thrust cast; Claude super plants the pen + casting palm held through
  active; DeepSeek super = crouch-gather → snap-point upward held; haiku three distinct strikes; chain1-3 distinct.
- Step 4 partial: throwHit reworked for both (grab → pull/heave → palm shove / overhead slam, `grab` anchor follows);
  Claude hair can no longer flip above its root (getup). intro reviewed OK.
- Pass 3 step 1 DONE: movement (Claude deeper squat/land squash, dash push-off + glide lift, backdash land squash;
  DeepSeek land bounce). Tool: `node tools/rig-sheet.mjs --multi <char> anim:f,f anim2:f --name x`.
- Pass 3 step 2 DONE: 2L 2M 2H jL jM jH both chars frame-checked (lows hit low, Claude 2H = chop ending flat on the
  floor, DS 2H floor sweep, jump attacks down-forward, held impacts, smears only in front).
- Pass 3 step 3 DONE: sonnet/airSpark/guardrail(+Hit) Claude; wave (knee-raise → stomp, muzzle at toe), breach, diveIn/Out,
  diveKick DeepSeek. Reach re-tuned to the engine's design list (DS 2M 40, 2H 46, jH 30; Claude 2L 31, jM 33); sonnet/breach
  weapon = nib / kicking toe throughout rise.
- Pass 3 step 4 DONE: hitLow/hitCrouch (pen no longer through the floor), thrown, throw whiff reviewed; Claude win = twirl →
  caps the pen → holds it to her chest smiling; DeepSeek win = crouch → jump fist-pump; loses reviewed; Claude super plant
  smear shortened; intro bow holds the pen down at her side.
- ALL anims for both characters have now had at least one frame-level review pass. Known remaining weaknesses: see report.
- Perf (Chromium): draw worst case (re-render every frame) 0.41–0.46 ms Claude / 0.25–0.29 ms DeepSeek; cached frames
  are one drawImage. init 1–1.6 ms (head expressions are composed/rotated lazily). setPose+anchor ≈ 3–4 µs, no canvas.

## How it works (design summary)

- `raster.js`: palette-INDEXED buffer (index = 2 + material*4 + tone; 0 empty, 1 outline). Primitives: tapered capsules,
  polygons, ellipses, indexed stamps, Bresenham lines — all sampled at pixel centres, no AA. Each body part is drawn as a
  *group* into scratch, then composited with a 1-px 4-neighbour outline (exterior = `PAL.outline`; interior = the front
  part's deep tone, or the outline colour when what is behind is darker). Cel shading is per primitive (light from the
  upper front). Flash / silhouette / palette = LUT swaps; mirroring is done in the index→RGBA copy (exact).
- `skel.js`: poses, eased keys per segment, time quantised to `step` frames (held drawings, default twos),
  2-bone IK for arms/legs, integer skeleton. Anchors/bounds come from this only → deterministic, canvas-free.
- `secondary.js`: verlet chains (hair, side locks, ahoge, capelet, skirt, tie / pigtails, whale tail, hoodie strings,
  hem) with world inertia from `tick(env)` velocity, drag, gravity, floor, hysteresis snapping (no shimmer at rest).
- `core.js`: API + Puppet. Re-renders only when the integer state (joints, chains, expression, blink, smear) changes.
  Foot lock: during `walk` anims, planted feet (`plant: 'F'|'B'`) are pinned to an integer world x (visual only, ±2 px).
- `chars/<id>-art.js`: hand-made head stamps (3/4 view) + eye/mouth overlays; tilt = RotSprite of the base with upright
  features placed at rotated positions (exact rotation at multiples of 90°).
- `chars/<id>.js`: proportions, rest pose, palette→material ramps, chains, part renderers, anchor helpers.
- `anims/gen.js` (walk/shuffle generators), `anims/<id>-base.js` (common), `anims/<id>-attacks.js` (attacks).

## Pose format (authoring)

All coordinates are local to the origin (ground point between the feet), facing right, +x forward, +y DOWN.
Vectors: `root` (whole-body offset), `hip` (pelvis), `head` (offset from neck), `hF`/`hB` (front/back hand targets),
`fF`/`fB` (front/back sole points), optional anchors `muz`, `grab`, `wpn`. Scalars (deg): `lean` (torso, + forward),
`bend` (chest relative to lean), `tilt` (head, + nods forward, -90 = lying face up), `faF`/`faB` (foot pitch, + toes down),
`pen` (Claude pen angle, 0 = forward, +90 = down), `pg` (grip position along the pen, 0..1), `sq` (spine squash px),
`shr` (shoulder raise px). Discrete: `eyes` (open half closed happy focus shut dizzy sad wide), `mouth` (neutral smile
open shout teeth hurt o frown grin), `handF`/`handB` (fist grip open flat relax point), `elF/elB/knF/knB` (bend side ±1),
`z` ({armF, armB, legF, legB, pen} layer overrides; torso = 0, head = 2, front arm = 5), `glow` (nib/glove glow),
`blush`, `smear` ({ part: 'pen'|'hF'|'hB'|'fF'|'fB', from: 'seg+N', n }), `weapon` (DeepSeek: limb for the anchor),
`penIn` ('F'|'B'|'none'), `plant` (walk foot lock).
V2 Claude extras: `bm` book holding mode ('B' rear hand | 'F' | 'both' | 'float' at `bk` | 'none'), `book` spine angle
(-90 upright), `bko` 0..1 open, `bsc` book scale, `quill` true/false (angle `pen`, grip `pg`), `weapon` 'quill'|'hF'|'hB'|
'fF'|'fB'|'book', `muzAt: 'book'`, `air: true` (no skirt floor clamp), `skirt` flare, `hem` hem drop, `z.book`.
Helpers: `P(base, a, b…)` copy + overrides, `bob(base, dx, dy, ch)` move everything but the feet, `shift()`.

Anim definition: `I.defAnim(char, name, { segs: [[id, frames, loop?]...], step: 2, walk: px/f,
keys: [[time, pose, ease | {ease, step}], ...] })` — time = absolute frame or `'segId+N'`. Eases: linear in out inout
in3 out3 back snap(hold). Missing poses before a segment's first key are interpolated from the previous segment.

## Preview

- `dev/rig-viewer.html` (file:// OK): anim list, play/step/speed, zoom, anchors, bounds, timeline, onion skin, grid,
  ground, flash/silhouette, move mode (A/D, W, S, Shift+A/D), both chars at game scale.
- `node tools/rig-sheet.mjs <char> <anim> [n|0] [--pal 1] [--scale 6] [--anchors] [--mirror] [--walk]`,
  `--overview`, `--heads`, `--palettes`, `--versus`, `--perf`, or no args for everything → `.shots/rig/`.

## Contract deviations / additions

- `walkF`/`walkB` loops are 32/36 frames (Claude) and 32/32 (DeepSeek) instead of ~40/~44: with the specified walk
  speeds a 40-frame two-step cycle needs 26-px strides, longer than the legs. Feet are planted correctly at 1.3/1.0
  (Claude) and 1.7/1.3 (DeepSeek) px/f; `animInfo().walk` gives the authored speed.
- Additions: `animInfo().placeholder`, `animInfo().walk`, `LC.rig.stats`, `puppet.info()`.
- `sx` should be `Math.round(worldX - camX)` for the foot lock to be pixel-exact.

## Animation status (V1 text below is historical; see V2 progress above for Claude)

All §3.3 names exist for both characters; every one is authored (no aliases in use) and has been reviewed frame-by-frame
in contact sheets at least once (passes 1–3). Reach of normals (weapon anchor, px): Claude 5L 31 5M 46 5H 54 2L 31 2M 51
2H 51 jL 30 jM 33 jH 35; DeepSeek 5L 23 5M 37 5H 44 2L 24 2M 40 2H 46 jL 18 jM 23 jH 30.
Batch review sheets: `node tools/rig-sheet.mjs --multi <char> anim:f,f,... --name x` (anchors + bounds drawn).
