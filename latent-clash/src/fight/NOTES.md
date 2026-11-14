# FIGHT — NOTES

## Progress / next steps

Done: full engine, both move sets, CPU AI L1–5, HUD, training tools, presentation wired to the real
rig / fx / illust / stages / audio (all feature-detected). Tools: sim (invariants, determinism,
balance), shots, combo verifier. Verified with stubs **and** real modules: 0 sim violations,
deterministic, 0 console errors (incl. `--draw`), 8/8 combos.
Next (if time): hitbox retune pass against final rig poses (see "Depends on RIG"); AI polish
(L1 vs L1 is Claude-favoured); throw/tech feel review with a human; extra screenshots per stage.

## Run it
- Sandbox: `dev/fight-sandbox.html` (file:// ok). `?stubs=all` forces every stub (pure gameplay);
  default = real modules where present. P1 `WASD` + `J K L I` (L M H S), `U` = L+M, `O` = H+S;
  P2 arrows + `1 2 3 5` (or numpad / `, . / ;`). `F1` boxes, `F2` frame-step (`F6`/`]` = 1 frame),
  `F3` slow-mo, `F4` restart, `F7` reset positions. Query: `mode p1 p2 ctl1 ctl2 lv1 lv2 level stage
  seed pal1 pal2 intro rounds time dummy guard hitboxes manual`.
- `node tools/fight-sim.mjs [--n=30] [--levels=1,3,5] [--cross] [--real] [--draw] [--off=claude.spark,…]`
  CPU-vs-CPU at ~300k ticks/s (stubs) / ~170k (real modules), invariants every tick, determinism,
  balance table, move usage, damage by source. `--off` disables AI plans (ablation).
- `node tools/fight-combos.mjs [--real] [--debug]` — scripted bread-and-butter combos (below).
- `node tools/fight-shots.mjs [--real] [--boxes] [--only=a,b]` → `.shots/fight/*.png` (×3).

## Architecture (src/fight, load order = manifest)
| file | role |
|---|---|
| core.js | namespace, tuning table `F.T`, seeded RNG (mulberry32), geometry, guarded bridges to fx/audio/font/illust (`F.fx`, `F.sfx`, `F.sprite`, `F.text`…), error-once logging |
| input.js | per-fighter `Input`: history ring (effective time skips freezes), 6f button buffer, L+M / H+S merge (2f), lazy motion recognition 236/623/214/22/236236 relative to facing, 66/44 |
| moves.js | move data normalisation (`F.defineChar`), strength resolution, authored rig timings |
| chars/claude.js, chars/deepseek.js | character constants + every move as data |
| fighter.js | state machine, command parsing + priority, cancels (chain/special/super/rekka/kara-convert), move runner, physics, invulnerability, pose → `setPoseSeg` |
| combat.js | hurt/hit/push boxes, strike & projectile resolution, block (cross-up aware), scaling, juggles, counter-hit, pushback + corner transfer, gauge, throws/techs, counter-catch, projectiles, dive |
| match.js | `createMatch`, tick order, round flow, camera, KO/time-up/double KO/draw, flash, shake, banners, bubbles, snapshot, result |
| render.js | frame composition (§6), puppets (rig or built-in fallback), engine sprites, after-images, cut-in, banners, bubbles |
| hud.js | bars + lag trail, faces, names, pips with finish marks (超 技 投 T 削 P =), timer, gauges, combo, call-outs, move tag |
| training.js | dummy, auto-guard, refill, box overlay, input history, damage/combo/frame-advantage |
| ai.js | CPU (see below) · movelist.js | `getMoveList` |

Tick order: AI → input push (frozen flag) → [super-flash freeze returns here] → timer → both
`step()` → positions (max separation 328, walls, push boxes) → projectiles → strikes collected
for both sides, then applied (trades work) → positions → facing → combos → training → KO/time →
camera → pose + `puppet.tick` → `fx.update` (skipped when both are in hit-stop) → `stage.update`.

## Move data format
See the header of `moves.js`. Segments drive the rig (`anim`, `as` = rig segment id) and timing;
`loop:'land'` segments last until landing. Hits name a segment (+ optional frame range `fr`,
`every` for multi-hits, `final` overrides). Stun is either `stun:[hit, block]` (fixed) or
`adv:[hit, block]` (frame advantage, converted using the attacker's remaining frames). Any number
may be `{L,M,H}`. Normals follow the rig `weapon` anchor tip-aligned, clamped to ±5 px of the
designed reach (±12 px vertically), so a pose change cannot move balance much; specials use their
designed boxes. The whale hitbox comes from `LC.fx.spriteInfo('deepseek.whale').frames[t]`
(fallback: a fixed box).

## How to tune
- Global feel in `F.T` (core.js): hit-stop, pushback, gauge, scaling, juggle limit, throw tech,
  KO slow-mo. Per-move numbers live in `chars/*.js`.
- Check every change with `fight-sim` (balance + invariants) and `fight-combos`.

## Systems summary
- Hit-stop L7/M9/H11/special 12/super 3 (+4 counter), both fighters for melee, victim+projectile
  for projectiles. Hit flash decays during hit-stop. Shake respects `LC.settings.shake`.
- Combo scaling 100,100,90,80,…,30 % (super ≥ 50 %); multi-hit moves share their first hit's scale.
  Hitstun decays after the 5th hit, combos longer than 5 s are capped → no infinites. Juggle
  points (max 5); light/medium air hits are "air resets" (land on feet, no more juggle).
- Counter-hit: +3/+6 stun, ×1.2 damage, `hit.counter`. Chip from specials (20 %) / supers (25 %).
- Throws 5f, unthrowable while in stun / 6f after / wake-up 6f / back-dash; tech = L+M within 8f
  (buffered presses count), throw vs throw = tech. Back throw `4`+L+M.
- Wake-up: knockdown 10f impact + 26f lie (8f if a button is pressed during the impact = quick rise)
  + 24f invulnerable get-up, then 6f throw invulnerability.
- `22` is ignored if a down+button press preceded it within 15f (2L → 2M stays a chain).
- Rounds: intro (lines alternate P1/P2, typewriter, any human attack button skips) → ROUND N /
  FINAL ROUND → FIGHT! → KO (final contact burst, 42f freeze, 72f half-speed) / TIME UP / DOUBLE
  K.O. → win pose (+ PERFECT) → next round with fade; draw rounds give both a point; a match where
  both reach the target is a draw (`winner: -1`). Match end: YOU WIN / 1P WIN banner, victory
  music, win quote (`winVs` 60 % else random), `finished` after any human button or ~9 s.
- `result.score` (for P1): damage×10 + maxCombo×300 + rounds×3000 + time bonus + supers×1000
  + 5000 win (+10000 perfect).

## Bread-and-butter combos (verified by tools/fight-combos.mjs, stubs and real rig)
Claude: `jH > 5L > 5M > 5H > 214H` (7 hits, 383) · `2L > 2M > 2H` (185, knockdown) ·
`5M > 5H > 236H` (246) · `jH > 5M > 5H > 214H > SUPER` (14 hits, 515).
DeepSeek: `jH > 5L > 5M > 5H > 214H > S > S` (rekka, 407) · `2L > 2M > 5H > 236H` (close, 254) ·
`5L > 5M > 623H` (222) · `jH > 5L > 5H > 214H > S > S > SUPER` (13 hits, 548).

## CPU AI (ai.js)
Same input interface as a human (held buttons; motions typed out frame by frame). Perception is
a delayed copy of what is visible (opponent position, current move + phase, projectiles):
reaction 28/22/17/13/10 frames for L1–5. Per level: block chance .12–.88, high/low guess
.5–.8, anti-air .04–.78, whiff-punish .06–.86, combo depth (0: random single hits … 3:
confirmed chains → special → super), throw-tech chance .03–.55, decision interval. Neutral plans
are weighted by distance/character/aggression (aggression rises when behind or late in the
round, and with idle time) and penalised ×0.55 per recent repeat. Claude: zoning sparks, pokes,
guardrail reads, haiku punishes. DeepSeek: rekka pressure (stops on block at high level), wave,
dive mix-ups through projectiles, dive kicks, jump-ins. Wake-up: block / reversal DP / back-dash
/ throw. `F.AI_OFF = { 'claude.spark': 1 }` disables plans (sim ablations).

## Balance (fight-sim, n = 100 matches per pairing, both side assignments)
stubs: 1v1 66 % · 3v3 41 % · 4v4 48 % · 5v5 48 % Claude wins; real rig (n=60): 3v3 47 % · 5v5 50 %.
Rounds average 19–28 s, no time-ups between CPUs.

## Contract deviations / additions
- Additions: `match.forceBoxes` (draw boxes outside training), `match.result.finishes`
  (per-round finish kinds) and `.rounds`, snapshot `state` never reports internal names.
  `LC.fight`: `F.T` tuning, `F.chars`, `F.AI`, `F.headless` (tools), `F.AI_OFF`.
- training opts: also `level` (dummy CPU level).
- `match.update` swallows exceptions (logged once each); after 30 errors the match finishes.
- Double KO / draw rounds award both players; possible `winner: -1`.

## Depends on other modules
- RIG reach vs design (weapon anchor tip at active, px): DeepSeek 2M 30 (design 40), 2H 26 (46),
  jH 21 (30); Claude 2L 39 (32), jM 48 (34). Currently clamped to ±5 px of design; either the rig
  poses or these boxes should be reconciled. Rising specials' `weapon` anchor sits inside the body
  — not used for hitboxes.
- FX: `claude.beam` drawn at the `muzzle` anchor (clamped to the beam hitbox); whale hit boxes from
  `spriteInfo`. AUDIO voices/music calls are guarded (silent until present).

## Known issues
- L1 vs L1 is Claude-favoured (66 %); mashing AIs benefit from her reach.
- The training stage's own signage sits where the move-name tag / combo counter go (stage art).
- Speech-bubble wrap width tuned for the 10 px font only.
