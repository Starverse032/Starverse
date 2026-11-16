# Gemini 娘 — rig notes (Gemini animator)

Design source: CONTRACT-V2 §V2.6 + `LC.PAL.gemini` (slots hair2, ear, eye2, lining, star). Files: `chars/gemini-art.js`
(head stamp, faces, hands, star stamps), `chars/gemini.js` (body, chains, renderer), `anims/gemini-base.js` (common
set + airJump), `anims/gemini-attacks.js` (normals, specials, super). Registration: `manifest.js` (load order; all
four gemini files exist), `anims/placeholders.js` (her segment table + aliases).

## Progress / next steps (kept current for restarts)
- DONE: registration (manifest, placeholders table + aliases, charInfo 96/64/24, palettes 0/1). Every required anim
  exists (unauthored ones are placeholders aliasing `idle` etc.), so the engine can load her.
- DONE step 1 (first pass): body + look; versus at game scale matches the other three (scale, outline weight).
- DONE step 2 (first pass, sheet-reviewed once): idle (toe bounce, paw flex, sly head-tilt), walkF/walkB (custom
  16-key `G.catWalk`, 1.8 / 1.5 px/f, 32-f loops), crouch set (pounce-crouch, tail up), jump set, airJump (6-f tuck
  flip via `I.gemSpin`), land, dashF (pounce leap), dashB (springy hop), guards (sleeves crossed, ears flat), hits,
  launch, down, getup (all-fours → spring up). Ears fold flat (`ears: 'flat'` → head extra) on guards/hits/down.
- DONE step 3 (first pass, sheet-reviewed): 5L/2L/jL claw swipes (pink smear + claw glow), 5M snap kick, 2M slide
  kick, jM air kick, 5H/2H/jH spinning heel kicks (`flip`, tail locked behind the leg). Reach at the first active
  frame (weapon anchor x): 5L 30 · 5M 48 · 5H 58 · 2L 31 · 2M 51 · 2H 60 · jL 27 · jM 38 · jH 46 (all within ±2).
- DONE step 4 (first pass, sheet-reviewed): star (stars gather to the hand → card flick, muzzle = hand (34,-75)),
  airStar (muzzle (28,-46), 45° down), starRise (corkscrew: alternate drawings flipped, claw high), twin (paws
  together → fling + finger-to-cheek wink), twinStrike (pounce → lunging double-claw X swipe, reach 46),
  blinkOut (curl → checker dissolve → star glint s9/s7/s3: `only: 'star'`), blinkIn (reverse + flourish), super
  (gather → twirl → hand to the sky, held; arm sweeps down to point ahead at active+44 for the X beams; wink).
- TODO step 5: throw, throwHit, thrown, intro, win, lose.

## Implementation notes
- Materials re-purposed: legs = violet hair (hair2), tip = pink ends, shoe = violet lining, white = gold eye (eye2),
  blush = ear pink, glow = star facets (white/cyan/pink/yellow), smear = pink-white.
- Pose channels re-used: `book` = coat-panel flare, `bko` = panel lift (deg), `bk` = lead star offset. Author with
  `coat`, `cl`, `st` through `I.defGem` (maps them).
- Extra pose fields: see the header of `chars/gemini.js` (tail/arch/pen/tl/tsw like GPT, stars, claw, flip, weapon,
  drape, hd, hs, air, only:'star', dith).
