# DeepSeek 娘 V2 — progress / next steps (DeepSeek animator)

Design source: CONTRACT-V2 §V2.1 (rewritten from the reference picture) + `LC.PAL.deepseek` (under, fin, gold metal).

## Done
- `chars/deepseek-art.js`: new 28×20 head stamp (3/4 right; headdress + cyan bow, drooping fin, open smile w/ fang),
  eyes/mouth overlays, own V2 hand table (`I.ART.deepseek.hands`, passed to `H.hand`).
- `chars/deepseek.js`: 98-px body (spine 30, neck 7, arms 15+13, legs 23+22+3), materials re-purposed locally
  (white = hair mid-gradient, shoe = fin ramp, legs = under-skirt; tights = c1, shoes = darker cloth ramp),
  skirt surface (front/back hem chains + leg-collision limits) with under-skirt panel, pinstripes, gold trim,
  petticoat frill, apron (frills + whale emblem), bodice/blouse/gold buttons/collar bow, puffed sleeves + frilled
  cuffs, tights + mary-janes, wavy gradient hair locks, pose-driven whale tail (`tail`, `arch`, `pen`, `tl`, `tsw`)
  with constant sway, `flip` (mirrored drawing for spins; anchors mirrored), weapon tips incl. knee and tail.

- V2-authored (first pass, reviewed in sheets): ALL base anims (idle, walks, crouch set, jump set, land, dashes,
  guards, hits, launch/down/getup, throw/throwHit/thrown, intro = curtsy→stretch-yawn→stance, win, lose).
- V2 normals: 5L palm, 5M snap kick, 5H spin tail lash (flip), 2L, 2M low poke kick, 2H spin floor tail sweep,
  jL palm, jM flying knee (weapon 'kF'), jH stomp kick. Reach measured: 5L 32 5M 50 5H 63 2L 34 2M 52 2H 65
  jL 30 jM 40 jH 48.
- Skirt: raised legs drape the hem over the thigh (`drape()`), so kicks/knees show the leg.

## Next
- Specials (wave, breach, chain1-3, diveIn/Out, diveKick) + super are STILL OLD DATA (v1 scale) until replaced.

## Tools
- `node .shots/rig/ds-sheet.mjs <name> <scale> <cols> anim:f,f anim:n8 ... [--anchors] [--info] [--walk] [--pal 1]`
- `node .shots/rig/ds-zoom.mjs <name> <anim> <frame> <scale> x0 y0 w h` → `.shots/rig/ds/<name>.png`
