# GPT 娘 — rig notes (GPT animator)

Design source: CONTRACT-V2 §V2.5 + `LC.PAL.gpt` (slots scale, wing, blob). Files: `chars/gpt-art.js` (head stamp,
faces, hands), `chars/gpt.js` (body, chains, renderer), `anims/gpt-base.js` (common set), `anims/gpt-attacks.js`
(normals, specials, super). Registration: `manifest.js` (load order), `anims/placeholders.js` (her segment table +
aliases). Dev: `dev/rig-sheet.html` `sheetMulti(..., noAnchors)` and `sheetVersus` now shows all three fighters;
`tools/rig-sheet.mjs --multi ... --noanchors`.

## Progress / next steps (kept current for restarts)
- DONE step 1: registration (manifest, placeholders table + aliases, charInfo 102/68/28, palettes 0/1) + body + look.
- DONE (first pass, sheet-reviewed once) steps 2–5: every required anim is authored (42, no placeholders, segment
  table check passes): base set, normals (reach on target), breath, airBreath, dragonRise, call, callHit, roar,
  super, throw, throwHit, thrown, intro, win, lose.
- NEXT: polish pass (look at ×5 per group), walk foot-slide check (`--walk`), perf, final report.

## Implementation notes
- Materials (15 shared slots, re-purposed locally): legs = `scale`, shoe = `wing`, white = `blob`.
- Pose channels re-used: `book` = wing spread (0 half-folded .. 1 spread), `bko` = wing raise (deg), `bk` = blob
  offset. Author with `wing`, `wf`, `blob` through `I.defGpt` (maps them onto the channels).
- Tail: pose-driven curve (`tail` swing, `arch` curl ×10, `pen` whip) + slow sway; `tl: 1` locks it to the pose.
- `flip: 1` draws the frame mirrored (spins), like DeepSeek.
- Anchors: standard + `blob` (companion target, pose-only), `tail` (tail tip), `mouth`, `wingL` (lead wing tip).
  `top` = above the horn tips. `muzAt: 'mouth'` → muzzle = mouth.
