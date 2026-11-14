# FIGHT — NOTES

## V2 progress / next steps (CONTRACT-V2 retune — keep truthful)
- [x] 1 retune to the V2 bodies (boxes, movement, spacing, reach, specials, fx positions); sim, combos, box shots
- [x] 2 presentation fixes: training panels now under the cut-in; move tag under the name row on an opaque
  plate (y 31), combo counter on a plate (y 50); HUD checked with 104-px fighters (jump/sonnet heads pass
  behind the HUD, as allowed by V2.2)
- [x] 3 full-screen presentation per `src/fx/NOTES.md` "V2 integration" (list below)
- [x] 4 notes
Verified (real modules): sim 0 violations, deterministic, 0 console errors (also `--draw`); combos 8/8
(stubs + real, `--spread` shows each works from −16 px to +8/+16 px of its start distance); box sheets
(`fight-shots --real --boxes --sheet`) show hurt/hit boxes on the new sprites.
Balance (real, n = 400 per row, seeds 11 + 12): **L3 ≈ 43 % Claude** (41.8 / 44.5), **L5 ≈ 53 %** (53.1 / 52.5),
L1 ≈ 63 %. L3 sits just under the 45–55 % band and did not move with any data tweak tried (chain lunge, spark
recovery, beam speed, whale damage, dive spacing); L3 ablations show Claude's own AI jump-ins / raw haiku
cost her most. Next: AI work at L3 (Claude neutral plan quality), not move data.
Next / open: illust init currently throws (`src/illust/claude.js:142 k is not defined`, not ours — portraits /
icons fall back); `screen.koFlash` + `koBackdrop` with `settings.flash=false` only checked in code, not shots.

### V2 tuning numbers (chars/*.js, `F.T`)
| | Claude | DeepSeek |
|---|---|---|
| push stand / crouch / air / down | 26×66 / 28×50 / 22×64 (−84..−20) / 30×26 | 28×64 / 30×48 / 24×60 (−80..−20) / 30×26 |
| hurt stand | head −104..−72, body 30×74 | head −98..−68, body 31×70 |
| hurt crouch / air / launch | body 34×52 + head (2..26, −70..−50) / 28×84 (−102..−18) / 44×64 | 34×48 + head (4..28, −66..−46) / 28×80 / 46×62 |
| walk F/B · dash F/B | 1.6/1.2 · 76/18f, 64/20f | 2.0/1.5 · 92/16f, 72/18f |
| jump vy/g/vxF/vxB | 7.92/.36/2.9/2.5 (apex 84, 44f) | 8.57/.39/3.2/2.7 (apex 90, 44f) |
| normals tip (box x+w) 5L/5M/5H · 2L/2M/2H · jL/jM/jH | 43/62/74 · 44/64/72 · 39/48/61 | 34/52/65 · 36/54/67 · 32/42/50 |
| throw range | 58 | 56 |
Normals follow the rig `weapon` anchor (tip = anchor + 2, clamped ±5 / ±12 of the box above); designed boxes
are centred on the measured anchor, so stubs and rig agree. `F.T`: WALL 22, MAXSEP 320, START_SEP 168,
CAM_MARGIN 30, PUSH L 9/9 M 13/12 H 18/16 S 20/18, LAUNCH_K 1.25 (launch vx/vy/gravity, holdY speeds, KO
and throw arcs: 25 % taller, same airtime → juggle timing unchanged), IMPACT 8.
Specials: spark spawns at `muzzle` (40,−78) and eases to cruise −62 (hits crouchers), box L18/M22/H26,
vx 3.0/4.2/5.4, recovery 25 (was 28, balance); airSpark 22 box, vx 2.4/3.2/4.0, vy 3.3/2.6/2.0; sonnet rise
54/70/83 px (vy0 8.3/10.7/12.7, 14f), box (0..46, −136..−4); haiku boxes tip 62/60/74 up to −110, lunge ×1.3,
hit3 block −3/−4/−7; guardrail catch box (8..62, −106..0) + attacker yanked to 64 px (6 px/f, `pullTo`);
guardrailHit (4..84, −106..0); beam y −116 h 68, x0 44, grow 56/f to 420, drawn 16 px ahead of the muzzle
(`fwd`) so the book does not hide her face. Wave box 34×34, vx 3.4/3.8/4.2, range 140/230/∞; breach rise
×1.2, box (2..50, −122..−6); chain lunge 4.2/5.7/7.0, boxes tip 48/42/40; dive M surfaces 44 px in front
(≤124 travel), H 46 px behind, exit box (−22..36, −116..0); diveKick vx 3.8/5.0/6.2, vy 7.0/5.8/4.8 (angle
62/49/38°); whale: 7 hits (6 × 36 holding + final 90 at whale t 44), victim carried forward (`pull` 110 +
3/frame of whale t, `setPush`), boxes from `spriteInfo('deepseek.whale').frames[t]`, t = frames since cast f0;
tidal: one hit (60, blockable, grounded opponents only, `jug: 99`) from `spriteInfo('deepseek.tidal')` rel. the
crash point (whale x + `crashX`), recovery f0–30 (tidal t 6–36). Fallback boxes used when fx lacks frames.
Contact point = centre of the hit box ∩ touched hurt box. AI distance constants ×1.3 (`D()` in ai.js),
reach margins +15.

### FX V2 wiring (render.js composition slots, see fx NOTES)
Wired: [A] `screen.superBackdrop` from cast f0 (stage under it for t < 8), outro `phase:'out'` at
recovery f12 (Claude) / f26 (DeepSeek) (`mv.bgOut`), also when a super is interrupted; `screen.koBackdrop`
or (super KO) `screen.superFinish` from koFlash t 5 until the KO'd body has landed; stage.drawFront skipped
while any backdrop shows. [B] `screen.superBg` in the flash; `screen.impact` 8f on H hits, counters,
launchers / knock-down specials (`impact: true`), throws — t advances 2 frames then holds in hit-stop
(counter → `phase:'counter'`, specials tinted with `char`). [C] `deepseek.whale` (back layer, t 0–59).
[D] projectiles (spark `power` .3/.6/1), guardrail, `claude.beam` charge/fire/fade → `claude.book`, `deepseek.tidal`
at the crash point. `deepseek.whaleSplash` at whale t = `events.crash` at x + `crashX` (+ shake). `claude.pages` at
cast f4. [E] koFlash → bubbles → HUD → training panels → cut-in → banners. Specials: `claude.sonnetPillar` /
`deepseek.breachCrescent` at the origin on the first rise frame (`riseFx`), breachTrail at `tail`,
`deepseek.geyser` on emerge, `claude.guardCatch` at the origin. Dive: puppet clipped at the ground line
(`clipFloor`). Not done: KO flash/backdrop length not tuned against the slow-mo (body usually lands
≈ 40–60 frames after the KO).
Tools: `fight-shots --sheet[=2] [--cols] [--tag]` contact sheets; `v2-*` scenarios (super timelines, super KO,
impact, KO); `fight-combos --spread`; `fight-probe` (rig anchors / fx spriteInfo dump).

## Progress / next steps (V1)

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

## Bread-and-butter combos (verified by tools/fight-combos.mjs, stubs and real rig, V2)
Claude: `jH > 5L > 5M > 5H > 214H` (7 hits, 383, start 130 px) · `2L > 2M > 2H` (185, knockdown, 50) ·
`5M > 5H > 236H` (246, 62) · `jH > 5M > 5H > 214H > SUPER` (14 hits, 515, 130).
DeepSeek: `jH > 5L > 5M > 5H > 214H > S > S` (rekka, 407, 140) · `2L > 2M > 5H > 236H` (close, 254, 34) ·
`5L > 5M > 623H` (222, 40) · `jH > 5L > 5H > 214H > S > S > SUPER` (13 hits, 536, 140).

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

## Balance (fight-sim, real modules, V2 — see V2 progress above)
L1 ≈ 63 %, L3 ≈ 43 %, L5 ≈ 53 % Claude wins (n = 400 per row). Stubs (n=40): 3v3 47–60 %, 5v5 40 %.
Rounds average 19–28 s, no time-ups between CPUs.

## Contract deviations / additions
- Additions: `match.forceBoxes` (draw boxes outside training), `match.result.finishes`
  (per-round finish kinds) and `.rounds`, snapshot `state` never reports internal names.
  `LC.fight`: `F.T` tuning, `F.chars`, `F.AI`, `F.headless` (tools), `F.AI_OFF`.
- training opts: also `level` (dummy CPU level).
- `match.update` swallows exceptions (logged once each); after 30 errors the match finishes.
- Double KO / draw rounds award both players; possible `winner: -1`.

## Depends on other modules
- RIG (V2): every normal's measured `weapon` tip matches the V2.2 reach table within 1 px; boxes are centred on
  the measured anchors (re-measure with `node tools/fight-probe.mjs --anims=5L,… --anchors=weapon`). Rising
  specials' `weapon` anchor is not used for hitboxes. DeepSeek's `tail` anchor drives breachTrail.
- FX: `claude.beam` + `claude.book` drawn at the `muzzle` anchor + 16 px (clamped to the beam hitbox); whale and
  tidal hit boxes, `events.crash`, `crashX` from `spriteInfo` (fallback boxes otherwise). AUDIO voices/music calls are guarded (silent until present).

## Known issues
- L1 vs L1 is Claude-favoured (≈63 %); mashing AIs benefit from her reach. L3 ≈ 43 % (DeepSeek-leaning).
- Training stage signage scrolls under the move tag / combo counter; both now sit on opaque plates.
- Speech-bubble wrap width tuned for the 10 px font only.
