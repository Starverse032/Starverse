# FIGHT — NOTES

## Gemini progress / next steps (CONTRACT-V2 §V2.6 — keep truthful, updated as work lands)
- [~] 1 `chars/gemini.js` + engine support (`twin.js`: twin entity, blink / swap, super twin + meteor boxes, mix-up
  rule; fighter.js double jump; combat.js multi-hit star, `at` hit ticks, grace rule; render twin / meteor; training
  twin box; stubs know Gemini) — written; scripted check (real modules) OK for normals, 3 stars (M flies over a
  standing / crouching opponent at 200 px, hits a jumper), starRise heights 47/57/67, twin L/M/H timings
  (hit 36 / 29 / 44 f after spawn), blink L/M/H (inv, hidden, positions, through the opponent, air variant), double
  jump (+≈ 40–60 px), super 320 raw / 82 chip. Not yet: AI, sim/combos, shots, move list.
- [~] 2 CPU (ai.js): Gemini plans (`geminiPlans` / `geminiNow` / `geminiAir`, `GEM` per-level knobs) + vs-Gemini
  logic for the others (pending-twin guard / back-dash, dispel pokes, blink-recovery punish only in the real
  recovery). Tuning in progress: interim real-module sim (n = 100 per side) Gemini's opponents win L3 56/54/49 %,
  L5 58/50/52 % (Claude / DeepSeek / GPT); data changes so far: damage +5–8 %, twinStrike pounce 2 px/f, twin
  gesture recovery 18 → 13 (rig recovery played faster).
- [ ] 3 sim / combos extended, balance (L1/L3/L5), no loops
- [ ] 4 shots
- [ ] 5 notes, `getMoveList('gemini')`

## GPT progress / next steps (CONTRACT-V2 §V2.5 — keep truthful, updated as work lands)
- [x] 1 roster generalisation (code): unknown ids fall back to the first registered `LC.CHARS` entry with a
  warning; fallback puppet height / palette, move-list order (`C.order`), trail parity, Claude's pages,
  AI profile table (`PROF` in ai.js) are per-character data; stubs know GPT (metrics, segments, anchors)
- [x] 2 `chars/gpt.js` written + engine support (flame hits, roar circle + projectile erase, command grab
  `tryCmdGrab`/`callStep`, hard knock-down, super target latch + pin, breath / attention rendering, box overlay)
  — mechanics checked with a scripted test (real modules): breath 90/96/102 (3 hits, hits crouching DeepSeek
  at M), blocked breath chip 21; dragonRise 150 (H); call 170 / 190 vs crouch, grabs a blocking dummy,
  whiffs at 66 px and vs jumping; roar 90/100, L whiffs at 85 px; super 330 raw (5 hits), 84 chip blocked
- [x] 3 CPU: GPT plans (breath, tail pokes, call vs guarders, tick-call, oki mix-up, roar vs projectiles /
  anti-air / wake-up / DeepSeek's dive, airBreath, punisher, buffered dragonRise vs a blocked rekka,
  lunge-aware guard) and vs-GPT logic for the other two (escape jump/back-dash, fewer projectiles close,
  whiff-call punish, wake-up jump/back-dash). Tuning: GPT walks / dashes in much less (`gWalk` L1 .8, L2 .4,
  L3 .35, L4 .2, L5 .15), jump-ins ×.25 (`gJump`, L1 ×1), throw ×.35 (`gThrow`), breath ×1.7 vs DeepSeek (`PROF.gpt.vs`)
- [x] 4 sim (all pairings: `--pairs`, `--mirror`, `--plans`, `--mu`) and combos (`--all`, `--vs`, `--chars`, `wN`,
  oki-loop check); GPT combos 5/5 OK vs both (stubs + real); oki loop escapable (back-dash / jump /
  reversal beat every meaty timing). Sim (real): 0 violations, deterministic (5 det. pairs incl. GPT mirror),
  every match finishes, 0 console errors (also `--draw`, all pairs + mirrors). Balance below.

### GPT balance (real modules, `fight-sim --n=150 --levels=1,3,5 --real`, seeds 31 / 32 / 41 / 42 → 1200 matches per cell, both sides)
| A vs B (A win %) | L1 | L3 | L5 | per-seed range L3 / L5 |
|---|---|---|---|---|
| Claude vs DeepSeek | 54.6 | 49.4 | 55.4 | 47.7–51.0 / 52.5–57.0 (bit-identical to the pre-GPT code on the same seeds) |
| Claude vs GPT | 50.1 | 46.6 | 48.7 | 44.3–48.7 / 47.2–49.7 |
| DeepSeek vs GPT | 52.4 | 52.7 | 53.7 | 47.3–61.2 / 50.0–56.3 |
Rounds 21–31 s, no time-ups. Single 300-match runs vary more than binomial noise (seed blocks); use ≥ 2 seeds.
Next: DeepSeek–GPT is the least stable cell (one seed block at 61 % L3); GPT vs rushdown is AI-limited
(she rarely blocks DeepSeek's rekka step 1 — reaction 17f vs an 8f lunge), not data-limited.
- [x] 5 shots (`fight-shots --real --boxes --only=gpt-`): normals, specials, call sequence, roar erasing a
  spark, super timeline, super KO, intro / HUD / win quote checked (see "GPT shots" below)
- [x] 6 notes (this section), `getMoveList('gpt')` (breath + airBreath, call damage from callHit, multi-hit totals per strength)

### GPT tuning numbers (`chars/gpt.js`)
| | GPT 娘 |
|---|---|
| hp / height | 1000 / 102 (crouch 68, push width 28) |
| push stand / crouch / air / down | 28×64 / 30×48 / 24×62 (−82..−20) / 30×26 |
| hurt stand / crouch / air / launch | head (−9..11, −102..−72) + body 30×72 / 34×50 + head (2..26, −68..−48) / 28×84 (−100..−16) / 46×64 — body only (no wings / tail) |
| walk F/B · dash F/B | 1.4/1.1 · 70/20f, 60/22f (inv 9) |
| jump vy/g/vxF/vxB | 7.45/.324/2.6/2.2 (apex ≈ 82, 46f) |
| normals s/a/r | 5L 6/3/9 · 5M 9/4/15 · 5H 13/5/24 · 2L 6/3/10 · 2M 9/4/16 · 2H 12/5/25 · jL 5/6 · jM 8/6 · jH 11/6 (V2.5) |
| normals tip (box x+w) / dmg | 5L 38/40 · 5M 56/70 · 5H 70/110 · 2L 40/36 · 2M 58/66 · 2H 75/100 (kd) · jL 34/40 · jM 46/68 · jH 56/105 |
| adv [hit, block] | 5L +3/+1 · 5M +2/−2 · 5H +2/−6 · 2L +2/0 · 2M +1/−3 · 2H kd/−12 · jL/jM/jH stun 12/9, 15/11, 19/14 |
| throw | range 58, 120 (generic) |
| breath 236 | startup 11/12/13, active 16 (hits at sf 0/6/12, `every` 6), rec 20/22/24; flame length 60/85/110 from the mouth (`muzzle`, clamped ±10 of (23,−81)), box = `spriteInfo('gpt.breath').box(len·min(1,(sf+1)/6), 0)`; 30/32/34 ×3, adv last hit +2/+1/0, block −6/−8/−10, push 6 (last 14/18), chip .2, `noCatch` (barrier does not catch it), never a projectile |
| airBreath j236 | startup 10 (vy 0.3), active 12 (vy 0.5, hits every 4), rec loop-land, land lag 8, minHeight 30; 45° box, 26/28/30 ×3, stun 18/12 |
| dragonRise 623 | 5 / rise 14 (vy0 −8/−10/−12, g .57/.71/.86, vx 1.2/1.6/2.0 → ≈ 52/65/78 px) / fall loop / land 14; strike-inv 0–6/8/10, throw-inv 0–40; box (0..44, −130..−4) rise f0–8, 110/130/150, launch, block stun 18 |
| call 214 | startup 6/7/8, active 3, rec 28/30/32; grabs at origin distance ≤ 56/60/64 whatever `throwable()` allows (grounded, not in hit/block stun or the 6f after, not waking up / 6f after, not back-dashing, not throw-inv moves); no tech |
| callHit | hold 14 / rise 16 / slam 12 / rec 22, inv all 0–52; victim chest on her `grab` anchor (origin stays on the floor); released on the last slam frame: 150/170/190, bounce (juggle 99) → hard knock-down (no quick rise), `gpt.callSlam` + impact + shake |
| roar 22 | 9 / 6 / 22–26; circle radius 56/70/84 at her chest (clamped ±12 of (−2,−73)), circle-vs-rect test, hits both sides; 80/90/100, launch lvx 3.2/3.6/4.0, block push 30/36/42 adv −6; erases enemy projectiles inside the circle on active frames |
| super | startup 6 (flash f5), cast 12, active 50, rec 30; inv 0–19; target = victim chest at cast f0 (`attnX/Y`), a comboed victim (hitstun / juggle-able launch / caught) is pinned (`caught`) 28f; boxes = `spriteInfo('gpt.attention').frames[t]` rel. the target: 4 × 55 (t 25/30/35/40, lv X, re-pin each hit) + 110 burst (t 44–49, launch); 330 raw, chip .25 (84), blockable; backdrop out at rec f10 |

### GPT bread-and-butter combos (`fight-combos --real --all`, vs Claude and DeepSeek)
`jH > 5L > 5M > 5H > 236H` (7 hits, 368, start 120 px) · `2L > 2M > 2H` (196, knock-down, 44) ·
`5L > 5M > 623H` (245, launch, 36) · `jH > 5M > 623H` (310, 110) · `5M > 5H > 236H (3 hits) > SUPER` (10 hits, 471,
52; wait for the 3rd breath hit, the cancel is allowed after the first). The command grab is never comboable
(stun / post-stun protection), so combos are callHit-less. Oki check (same tool): call → meaty call at every
timing k = −6..14 around the first throwable wake-up frame re-grabs a sleeping / blocking victim, but never one
who back-dashes, jumps or reverses (DP) — no unblockable loop.

### GPT CPU (ai.js)
`PROF` per character (DP id, preferred range, jump-in range, dash weight, raw-super range, `vs` matchup plan
multipliers). GPT: patient — walk-in / dash-in weights ×`gWalk` (L1 .5 → L5 .15) inside 150 px, extra `wait`,
jump-ins ×`gJump` .25, throw ×`gThrow` .35 (the command grab replaces it); tail pokes 5H/2H ×1.8; breath 62–145 px
(L/M/H by distance); call when ≤ 57 px weighted by how much the opponent guards (`oppGuard`), walk-up call,
tick-call after a blocked 5L/2L (timed to land after the 6f post-blockstun protection); oki: meaty call / 2M /
5H at the opponent's get-up; roar vs incoming projectiles (arrival-time estimate), as anti-air (≤ 64 px), on
wake-up; dragonRise anti-air / reversal / vs a blocked rekka (buffered in blockstun); airBreath from jump-ins;
punisher: call (≤ 56 px) / normals / breath; combos end in breath H or dragonRise H, super after a breath hit.
Lunge-aware guard (start-up travel of the opponent's move counts toward the threat range).
vs GPT (Claude / DeepSeek): leave grab range (jump back / back-dash) when she is close and they blocked ≥ 2 times
in 150 ticks; projectiles ×.25 inside 150 px (no shots into a point-blank roar); whiffed call punished with
+.25 chance and a dash-in 5H; wake-up back-dash / jump chances +.1 / +.2 when she is within 72 px.

### GPT shots (`fight-shots --real [--boxes] --only=gpt- --sheet`)
Boxes sit on the sprite for every normal (claw at the hand, kick at the toe, tail tips for 5H/2H/jH, the
long tail extends her hurt box during active + 2/3 recovery); breath flame starts at the mouth and the box
covers the cone (L/M/H, crouching DeepSeek is hit at M); airBreath cone 45° down; dragonRise box on the claw;
roar circle (overlay draws the circle) and `gpt.roarRing`; roar erases a spark (`gpt-roar-vs-spark`); call
sequence: hold at her hand → lifted → slammed (victim in `launch` pose during slam) → `gpt.callSlam` on the
floor at release; super: flash cut-in (GPT portrait / 注意力即一切), backdrop reveal from her side, heads,
reticle and beams converge on the latched chest point, burst; super KO → GPT `screen.superFinish`; HUD face /
name / colours are hers on either side; intro line and win quote from `LC.LORE`.

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
- [x] 5 fix pass (AI balance, KO backdrop length, HUD plates):
  - AI: per-level Claude-only plan multipliers in `ai.js` `LV` (`cJump cHaiku cGuard cSpark cPun cMash cThrow`)
    plus `dChain` (DeepSeek rekka plan weight, L2) and rekka-on-block continue .5 at L2 (was .75). L2–L4: fewer
    jump-ins / raw haiku, more sparks, higher punish (cPun .5/.8/.95); L1: fewer Claude mashes / throws / sparks.
    **Balance (real, n = 400 per row, seeds 11 / 12): L1 50.6 / 53.1, L2 43.0 / 46.8, L3 45.6 / 50.9,
    L4 49.5 / 47.5, L5 55.3 / 52.0 % Claude** (L3 over 7 runs ≈ 48–50 %; L5 untouched, noise ±2.5 %).
  - KO: `screen.koBackdrop` / `superFinish` full until `T.KO_BG_HOLD` 64 ticks after the KO (or the body
    landing, if earlier), then a stepped alpha fade (.8/.6/.4/.2) over the stage for `T.KO_BG_FADE` 12 ticks
    (these sprites have no `phase:'out'`); stage (+ drawFront) back at ≈ 76 ticks, a running super's
    backdrop no longer returns after it. Slow-mo ends ≈ 114, win pose after. Shots: `fight-shots --only=kot-`
    (normal KO) / `kots-` (super KO) `--sheet`.
  - HUD: move tag (now y 32) and combo counter on fully opaque plates (black keyline + 1-px `U.line` border,
    accent stripe) — readable over the training sign on every stage.
  Verified: sim 0 violations, deterministic, 0 console errors (also `--draw`); combos 8/8.
Next / open: L2 sits at the low edge (≈ 45 %); illust init currently throws (`src/illust/claude.js:142 k is not defined`, not ours — portraits /
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
(`clipFloor`). KO backdrop length: see V2 progress item 5.
`dev/fight-stubs.js` stub rig updated to the V2 heights / anchors.
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
- `node tools/fight-sim.mjs [--n=30] [--levels=1,3,5] [--cross] [--real] [--draw] [--off=gpt.breath,…]
  [--pairs=claude-gpt,…] [--mirror] [--plans] [--quiet] [--mu=gpt>deepseek:breath=1.7;tail=2]` — every cross
  pairing of the roster by default (both side assignments), A-win % per pair/level; `--plans` counts AI plans.
  CPU-vs-CPU at ~300k ticks/s (stubs) / ~170k (real modules), invariants every tick, determinism,
  balance table, move usage, damage by source. `--off` disables AI plans (ablation).
- `node tools/fight-combos.mjs [--real] [--debug] [--all | --vs=gpt] [--chars=gpt] [--no-oki]` — scripted
  bread-and-butter combos (below) + the GPT command-grab oki-loop check.
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
After the item-5 AI pass: L1 ≈ 52 %, L2 ≈ 45 %, L3 ≈ 48 %, L4 ≈ 48 %, L5 ≈ 53 % Claude wins (n = 400 per row, 2 seeds). Stubs (V2 stub rig, n = 80): 3v3 51 %, 5v5 54 %.
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
- GPT: RIG `muzzle` (mouth in breath / airBreath, clamped ±10 px around (23,−81) / (30,−76)), `chest` (roar centre,
  ±12 px), `grab` (throwHit, callHit victim path; her origin stays on the floor during callHit), `weapon` (normals,
  riseTrail). FX `spriteInfo('gpt.breath').box(len, angle)` (flame hit area), `spriteInfo('gpt.attention').frames[t]`
  (super hit boxes rel. the latched target; fallback boxes t 25–43 / 44–49 without fx). Both caches are re-read
  in `F.init` (`F.resetGptInfo`). AUDIO `gpt.breath` (first active frame), `gpt.rise` (move start), `gpt.call`
  (grab connects), `gpt.callSlam` (release), `gpt.roar` (move start), `gpt.super` (cast f0 = heads appear).

## Known issues
- GPT: the breath hit box grows over 6 frames (`flame.grow`), the fx 'start' cone looks near full length by
  ≈ f2, so the box is a little shorter than the drawing on active f0–3 (conservative). L1 CPU GPT is favoured
  (see GPT balance). Claude–DeepSeek L5 sits ≈ 55 % on fresh seeds — identical outcomes to the pre-GPT code on
  the same seeds (verified: seed 31, L5, 52.0 % both), so this is sampling, not a regression.
- L2 ≈ 45 % (low edge of the band); other levels 47–53 %.
- Training stage signage scrolls under the move tag / combo counter; both sit on fully opaque bordered plates.
- Speech-bubble wrap width tuned for the 10 px font only.
