# RIG — notes

## Progress / next steps (kept current for restarts)

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
- NOW pass 3 (lead's order): 1) crouch*/jump*/land/dash* both → 2) 2L 2M 2H jL jM jH both → 3) remaining specials
  → 4) hitLow hitCrouch thrown throw win lose + Claude super smear + intro bow pen.
- REMAINING ROUGH (authored, overview-checked only): dashF/dashB, crouchIn/crouch/crouchOut, jumpSquat/jumpRise/
  jumpFall/land, hitLow, hitCrouch, throw (whiff), thrown, win, lose, crouching + jump normals (structure updated
  earlier but not individually reviewed), airSpark, sonnet, guardrail/guardrailHit, wave, breach fall/land,
  diveIn/diveOut, diveKick.
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

## Animation status

All §3.3 names exist for both characters and every one is authored (no aliases in use).
- Polished (reviewed at ×3–×8, corrected): idle, walkF, walkB, hitHigh, down, getup, guardStand, guardCrouch, launch,
  intro, throwHit, 5L, 5M, 5H (reach verified), Claude spark / haiku / super, DeepSeek breach (rise) / super;
  all faces, both palettes, costume details.
- Rough v1: see REMAINING ROUGH above.
