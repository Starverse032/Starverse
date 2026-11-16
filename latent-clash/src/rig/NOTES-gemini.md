# Gemini 娘 — rig notes (Gemini animator)

Design source: CONTRACT-V2 §V2.6 + `LC.PAL.gemini` (slots hair2, ear, eye2, lining, star). Files: `chars/gemini-art.js`
(head stamp, faces, hands, star stamps), `chars/gemini.js` (body, chains, renderer), `anims/gemini-base.js` (common
set + airJump), `anims/gemini-attacks.js` (normals, specials, super). Registration: `manifest.js` (load order; all
four gemini files exist), `anims/placeholders.js` (her segment table + aliases).

## Progress / next steps (kept current for restarts)
- DONE: registration (manifest, placeholders table + aliases, charInfo 96/64/24, palettes 0/1). Every required anim
  exists (unauthored ones are placeholders aliasing `idle` etc.), so the engine can load her.
- IN PROGRESS step 1: body + look. Body renders (hair locks with blue→violet→pink gradient, cat ears, bun + star clip,
  heterochromia, halter top, detached bell sleeves, short navy skirt over a white petticoat, chain belt + star pendant,
  coat-tail panels with star charms, thigh strap, leg warmers, platform shoes, fluffy tail, drifting stars).
  Idle is a stub (2-key bob). Still iterating the look (hair silhouette, sleeves, tail, panels).
- TODO step 2: base set (idle, walks, guards, hits, launch/down/getup, crouch set, jump set + airJump, land, dashes).
- TODO step 3: normals (reach 5L 30 · 5M 48 · 5H 58 · 2L 32 · 2M 50 · 2H 60 · jL 28 · jM 38 · jH 46).
- TODO step 4: star, airStar, starRise, twin, twinStrike, blinkOut, blinkIn, super.
- TODO step 5: throw, throwHit, thrown, intro, win, lose.

## Implementation notes
- Materials re-purposed: legs = violet hair (hair2), tip = pink ends, shoe = violet lining, white = gold eye (eye2),
  blush = ear pink, glow = star facets (white/cyan/pink/yellow), smear = pink-white.
- Pose channels re-used: `book` = coat-panel flare, `bko` = panel lift (deg), `bk` = lead star offset. Author with
  `coat`, `cl`, `st` through `I.defGem` (maps them).
- Extra pose fields: see the header of `chars/gemini.js` (tail/arch/pen/tl/tsw like GPT, stars, claw, flip, weapon,
  drape, hd, hs, air, only:'star', dith).
