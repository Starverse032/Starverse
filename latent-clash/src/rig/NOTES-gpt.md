# GPT 娘 — rig notes (GPT animator)

Design source: CONTRACT-V2 §V2.5 + `LC.PAL.gpt` (slots scale, wing, blob). Files: `chars/gpt-art.js` (head stamp,
faces, hands), `chars/gpt.js` (body, chains, renderer), `anims/gpt-base.js` (common set), `anims/gpt-attacks.js`
(normals, specials, super). Registration: `manifest.js` (load order), `anims/placeholders.js` (her segment table +
aliases). Dev: `dev/rig-sheet.html` `sheetMulti(..., noAnchors)` and `sheetVersus` now shows all three fighters;
`tools/rig-sheet.mjs --multi ... --noanchors`.

## Progress / next steps (kept current for restarts)
- DONE step 1: registration (manifest, placeholders table + aliases, charInfo 102/68/28, palettes 0/1) + body + look.
  Head stamp 30×28 (horns in the stamp, pointed ear + drop earring, rosette), 102-px body, slit gown, sleeves,
  wings, tail, blob. Reviewed at ×5–×8 and in the 3-fighter versus sheet; palette 1 checked.
- IN PROGRESS step 2 (base set): idle, walkF/B, crouch set, jump set, land, dashes, guards, hits, launch, down,
  getup written in `anims/gpt-base.js`; idle + walks reviewed once; the rest needs its first sheet review.
- TODO step 3: normals (5L 5M 5H 2L 2M 2H jL jM jH) + reach check (`node tools/rig-sheet.mjs --reach gpt`).
- TODO step 4: breath, airBreath, dragonRise, call, callHit, roar, super.
- TODO step 5: throw, throwHit, thrown, intro, win, lose (currently aliased by placeholders.js).

## Implementation notes
- Materials (15 shared slots, re-purposed locally): legs = `scale`, shoe = `wing`, white = `blob`.
- Pose channels re-used: `book` = wing spread (0 half-folded .. 1 spread), `bko` = wing raise (deg), `bk` = blob
  offset. Author with `wing`, `wf`, `blob` through `I.defGpt` (maps them onto the channels).
- Tail: pose-driven curve (`tail` swing, `arch` curl ×10, `pen` whip) + slow sway; `tl: 1` locks it to the pose.
- `flip: 1` draws the frame mirrored (spins), like DeepSeek.
- Anchors: standard + `blob` (companion target, pose-only), `tail` (tail tip), `mouth`, `wingL` (lead wing tip).
  `top` = above the horn tips. `muzAt: 'mouth'` → muzzle = mouth.
