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
- DONE step 5 (first pass, sheet-reviewed): throw (two-paw pounce-grab on air, pout, ears droop), throwHit (grab →
  hop onto the victim's chest → double-sole kick-off + back flip; self-contained hop root ≤ -24, grab anchor
  (30,-62) → (24,-62) → released at (56,-36) end of toss), thrown, intro (tuck drop-in → pounce-crouch → cat stretch
  → yawn-stretch → paw-lick → finger-to-cheek wink → stance), win (hop-twirl → finger-to-cheek wink, heel kicked up,
  sway, paw-lick loop), lose (ears flat, head hung, tail limp, sniffle loop).
- ALL 44 required anims authored (no placeholders; segment-table check passes, no console errors).
- Other fighters unchanged: claude/deepseek/gpt anchor hashes + render counts identical before/after (`--perf`).
- Perf: `--perf` gemini_drawMs ≈ 1.06 (worst case, re-render every frame; claude 1.05, gpt 1.02 in the same run).
- Second review round done on 5H/2H/jH (tail moved behind the kicking leg) and dashF (hair streams back, hd 50).
- NEXT (polish, if budget): hair is heavy/dark in the mid-back; front sleeve reads as a block when the paw is high;
  tail overlaps the hair ends in the stance; throwHit/airJump flip frames whip the hair (acceptable at speed);
  the near coat panel sometimes reads as a dark strip between the legs in walks.

## For the fight engine
- charInfo 96 / 64 / 24. Head crown ≈ -95, ear tips ≈ -104, `top` = ear tips - 4 (≈ -106 at rest).
- Anchors: standard set + `tail` (tail tip, pose-only curve) and `star` (lead drifting star: (-29,-84) at rest,
  behind her rear shoulder; = the front claw tip while `stars: 'hand'` (star, airStar, starRise, super)).
  `weapon` = claw tip (L, starRise, twinStrike), toe (5M, 2M, jM), heel/sole (5H, 2H, jH), raised hand (super).
  `muzzle` = flicking hand (star (34,-75), airStar (28,-46)), raised hand in super ((16,-104) → points ahead
  (≈35,-75) from active+44 for the X beams). `grab` in throwHit (see above).
- Mirrored drawings (`flip`): 5H startup+6 … recovery+5, 2H startup+6 … recovery, jH startup+7 … active, starRise
  rise+2 / rise+6 (corkscrew), super cast+4, win in+12. Anchors are already in screen space for those frames
  (starRise's weapon stays over her head: x ≈ +3 on the flipped drawings).
- Below the floor: grounded drawings are clipped 2 px under the origin; `air: true` poses (jump set, airJump, dashes,
  launch, starRise rise, blinkOut ball, throwHit hop, thrown, intro drop) are not clipped.
- Extents (drawn pixels, all anims): x -72 … +73, y down to -128 (throwHit hop) / -170 (intro drop-in from 40 px up).
  Stance: hair mass to x ≈ -44, tail tip ≈ (-38,-33), lead star ≈ (-29,-84).
- In-place self-contained offsets: throwHit hop (root up to -24, back to 0 at recovery), intro drop (root -40 → 0 by
  f9), win hop (root -16 → 0 by in+19), dashF leap (root -7), dashB hop (root -12).
- blinkOut: `vanish` 0-1 = checker dissolve (50 % / 75 %), vanish 2-4 = only a star glint at `center` (s9 → s7 → s3);
  blinkIn mirrors it (appear 0-2 star s3 → s9, 3-4 dissolve in), recovery = flourish → stance.
- The twin (twinStrike or any anim drawn with the same puppet): `draw(..., { flash: 0.7, flashColor: accent[1]
  ('#ff8fe0'), alpha: 0.55-0.65 })` reads as a pink-violet magic copy with detail; `flash 0.55 '#ffd6f6'` = paler
  ghost; `silhouette` loses all detail (after-images only). The twin also draws her drifting stars.

## Implementation notes
- Materials re-purposed: legs = violet hair (hair2), tip = pink ends, shoe = violet lining, white = gold eye (eye2),
  blush = ear pink, glow = star facets (white/cyan/pink/yellow), smear = pink-white.
- Pose channels re-used: `book` = coat-panel flare, `bko` = panel lift (deg), `bk` = lead star offset. Author with
  `coat`, `cl`, `st` through `I.defGem` (maps them).
- Extra pose fields: see the header of `chars/gemini.js` (tail/arch/pen/tl/tsw like GPT, stars, claw, flip, weapon,
  drape, hd, hs, air, only:'star', dith).
