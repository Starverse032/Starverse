# GPT 娘 — rig notes (GPT animator)

Design source: CONTRACT-V2 §V2.5 + `LC.PAL.gpt` (slots scale, wing, blob). Files: `chars/gpt-art.js` (head stamp,
faces, hands), `chars/gpt.js` (body, chains, renderer), `anims/gpt-base.js` (common set), `anims/gpt-attacks.js`
(normals, specials, super). Registration: `manifest.js` (load order), `anims/placeholders.js` (her segment table +
aliases). Dev: `dev/rig-sheet.html` `sheetMulti(..., noAnchors)` and `sheetVersus` now shows all three fighters;
`tools/rig-sheet.mjs --multi ... --noanchors`.

## Progress / next steps (kept current for restarts)
- DONE: registration (manifest, placeholders table + aliases, charInfo 102/68/28, palettes 0/1), body + look,
  and EVERY required anim (42, no placeholders, segment-table check passes), each reviewed in sheets at least once:
  base set, normals, breath, airBreath, dragonRise, call, callHit, roar, super, throw, throwHit, thrown, intro, win, lose.
- Reach (weapon at the first active frame): 5L 36 · 5M 54 · 5H 68 · 2L 38 · 2M 56 · 2H 73 · jL 32 · jM 44 · jH 54.
- Walks verified numerically: planted feet fixed in world space at 1.4 / 1.1 px/f (walkF 32 f, walkB 36 f).
- Floor: grounded poses are clipped 2 px below the origin (`!ds.air`); airborne poses (`air: true`) may hang below.
- Perf: `--perf` gpt_drawMs ≈ 1.0 (worst case, re-render every frame; Claude ≈ 0.95–1.1 in the same run).
  `I._gptProf = {}` enables per-step timing (no hotspot: tail, hair, wings, skirt, torso ≈ 0.05–0.1 ms each).
- Other fighters unchanged: claude/deepseek anchor hashes + render counts identical before/after.
- Weak / next (polish): white-on-white mid-body (near sleeve over bodice/skirt) is low-contrast in palette 0;
  horns are straight sweeps (no curl at the tip); the far horn is mostly hidden; hem rosettes read as small
  checkers; spins mirror the whole sprite (no back view); launch skirt hangs as a sheet.

## Implementation notes
- Materials (15 shared slots, re-purposed locally): legs = `scale`, shoe = `wing`, white = `blob`.
- Pose channels re-used: `book` = wing spread (0 half-folded .. 1 spread), `bko` = wing raise (deg), `bk` = blob
  offset. Author with `wing`, `wf`, `blob` through `I.defGpt` (maps them onto the channels).
- Tail: pose-driven curve (`tail` swing, `arch` curl ×10, `pen` whip) + slow sway; `tl: 1` locks it to the pose.
- `flip: 1` draws the frame mirrored (spins), like DeepSeek.
- Anchors: standard + `blob` (companion target, pose-only), `tail` (tail tip), `mouth`, `wingL` (lead wing tip).
  `top` = above the horn tips. `muzAt: 'mouth'` → muzzle = mouth.
- Pose-only geometry exposed as `I.CHARS.gpt.geo` (tailCurve, wingGeo, blobTarget, tipOf).
- `callHit` carries its own lift: root rises to -34 px during `rise` and returns to 0 at `slam+4`; the engine should
  keep her origin on the floor during callHit and place the victim by `grab`.
- Debug: `dev/rig-sheet.html` ticks gpt poses with `air: true` as ungrounded (preview only).
