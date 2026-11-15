# DeepSeek 娘 V2 — progress / next steps (DeepSeek animator)

Design source: CONTRACT-V2 §V2.1 (rewritten from the reference picture) + `LC.PAL.deepseek` (under, fin, gold metal).

## Status (2026-11-14): every §3.3 DeepSeek anim is V2-authored (no old v1 data left), first pass, sheet-reviewed
- Look: `chars/deepseek-art.js` 28×20 head stamp (3/4 right; headdress + cyan bow, drooping outlined fin with pale
  inner face, open smile with fang), eyes/mouths, own V2 hand table. `chars/deepseek.js`: 98-px body, skirt surface
  (navy over-skirt, pinstriped under-skirt panel, gold trim/bow, petticoat frill, apron with frills + whale emblem),
  bodice/blouse/gold buttons/collar bow + gem, puffed sleeves + frilled cuffs, tights + mary-janes, wavy gradient
  hair locks, pose-driven whale tail with constant sway, `flip` spins, `drape` (hem over a raised thigh).
- Base: idle, walkF/B (2 short steps per cycle, 2 cycles per 32-f loop, 2.0 / 1.5 px/f, G.walk planted feet),
  crouchIn/crouch/crouchOut, jumpSquat/Rise/Fall, land, dashF/B, guardStand/Crouch, hitHigh/Low/Crouch, launch,
  down, getup, throw, throwHit, thrown, intro (curtsy → stretch-yawn → stance), win (hop → wave, tail wag), lose.
- Normals: 5L palm, 5M snap kick, 5H spin tail lash (flip), 2L palm, 2M low poke kick, 2H crouch spin floor tail
  sweep (flip), jL palm, jM flying knee, jH stomp kick.
- Specials: wave (turn, tail raised, flip slam on the floor; muzzle [40,0]), breach (back somersault, tail sweeps a
  crescent in front; `spin()` helper rotates a pose about the hip), chain1 water hook / chain2 knee / chain3 rising
  palm, diveIn (head-first dive into the floor), diveOut (erupting palm), diveKick (both feet, `drape`), super
  (low gather → both arms up, held; tail raised).
- Reach (weapon anchor x at the first active frame): 5L 32 5M 50 5H 63 2L 34 2M 52 2H 65 jL 30 jM 40 jH 48.
- Perf: shared `--perf` deepseek_drawMs 0.82 (re-render every frame). `I._dsProf = {}` enables per-part timing.

## Polish pass 1 (2026-11-15) — done, sheet-reviewed
- New pose fields (deepseek.js): `pool` (discrete, 1 = the front hem runs over the knee cap and spills to the
  floor: crouch family inherits it from `POSE.crouch`), `hem` (core numeric channel, px, - = hem lifted), `tw` (core
  numeric channel, deg, hem swing; + = forward), `hs` (discrete 0..1: settle hair chains toward rest that tick — use
  after flips/hops), `wg` ('F'|'B'|'FB': cyan water bead + droplets at the palm tip). `C.sigExtra` adds hem/tw.
- crouchIn/crouch/crouchOut (+ guardCrouch, hitCrouch, 2L/2M/2H via the crouch pose): knees under a pooled skirt.
- walkF/walkB: `gait()` extra on `G.walk` — heel-strike toe-up / push-off toe-down, hem lifted 3–4 px and swinging,
  apron follows, bounce 2/1.5, tail counter-sway; speeds unchanged.
- launch (tumble: skirt/tail/hair whip alternating), getup (sit → kneel on hands with the tail braced → hop → land),
  thrown (limp dangle, head lolling, tail hanging), breach fall (`hs` settles the hair on the first fall frame).
- super: pooled crouch cupping water (`wg: 'FB'`) → snap point to the sky held with skirt/hair/tail flared and a
  slow breathing flare cycle → relaxed happy settle. throwHit: haul → overhead heave (tail braced on the floor) →
  forward slam with the tail flung up behind. intro: deeper curtsy holding the skirt → stretch-yawn (tail stretched)
  → eye rub → snap into stance with a tail flick. win: hop → bouncing wave/hand-on-head with tail wag. lose: shock →
  sulk (arms folded, head down, foot scuff, sigh), tail flat on the floor.
- Palm glow `wg` on 5L, 2L, chain1 (rear hand), chain3, super.
- Known, not mine to fix in this pass: 2H flipped frames (startup+8 … recovery+6) draw no skirt at all (pre-existing,
  verified against b06f962) — likely skirt surface degenerate in the flipped crouch frame.
- Hem lift during walks pops 3 px at walk start/stop (idle has no lift).

## Weak / next (polish)
- Hair stays blocky in silhouette; throwHit toss still flips the hair forward for ~2 frames.
- Hands are small stamps.
- No back-view head for spins (spins mirror the whole sprite instead).

## Tools
- `node .shots/rig/ds-sheet.mjs <name> <scale> <cols> anim:f,f anim:n8 ... [--anchors] [--info] [--walk] [--pal 1]`
- `node .shots/rig/ds-zoom.mjs <name> <anim> <frame> <scale> x0 y0 w h` → `.shots/rig/ds/<name>.png`
