# LATENT CLASH — Version 2 direction (addendum to CONTRACT.md)

Owner: LEAD. This file overrides CONTRACT.md wherever they differ. Everything not mentioned here
(namespaces, APIs, animation names and segment timings of §3.3, pixel-art rules, ownership rules,
no state-changing git, look at your own output) still applies.

The player reviewed the first complete build and asked for three things:

1. **Characters replaced by ZipZipPipe's popular fan designs** (see §V2.1).
2. **Street-Fighter-style realistic proportions** — tall, adult-proportioned fighters instead of the
   current ~3.5-heads-tall sprites — with **more refined, cooler animation**.
3. **Spectacular effects, including full-screen ones** on supers and big moments.

Also: usage budget is tight. Work economically: read only what you need, write to disk early,
batch your screenshot reviews, keep `NOTES.md` "progress / next steps" truthful so a restart is cheap.

---------------------------------------------------------------------------------------------------

## V2.1 Character designs (replaces CONTRACT §4)

Designs by the Bilibili creator **ZipZipPipe**. **Reference art (look at it before drawing):**
`.shots/ref/claude-ref.png` and `.shots/ref/deepseek-ref.png` (git-ignored; reference only — we
draw our own pixel art of these designs, never copy or trace pixels, never commit the files).
Credit lines are already in `LC.LORE.credits`. Colours come from `LC.PAL` in
`src/shared/config.js` (read it — ramps changed and new slots were added: `book` for Claude;
`under` and `fin` for DeepSeek).

### Claude 娘 — 橙发优等生
- The class's top student: tall, slender, mature, impeccably mannered, upright posture, a
  little strict. Serious composed face (small closed mouth, level gaze); cool focus when attacking.
- **Hair**: vivid orange (`hair`/`hairTip`), **straight and extremely long — down to the knees**,
  parted fringe with long face-framing locks, loose flowing strands at the ends.
- **Hair ornament** (side of the head): an orange **sunburst flower** (a ring of many thin
  petals around a core) on a **black ribbon bow** with a cream tassel hanging below it.
- **Eyes**: amber-brown (`eye`).
- **Outfit** — Victorian "classic" long dress, cream / black / orange with gold trim:
  - cream high-collared blouse with a frilled jabot; **black cravat** with a small orange
    sunburst-flower brooch at the throat;
  - short cream **capelet** over the shoulders (gold edging, an orange sunburst emblem on it);
  - long puffed cream sleeves with frilled cuffs;
  - wide **black corset belt** at the waist (gold buttons, a little gold chain);
  - **ankle-length layered skirt**: a cream pleated front panel; over it, to the sides, cream
    drapes lined in orange and **black panels with gold-line borders**; a long **orange sash
    panel** hanging down the front with gold tassels; a **black bow with an orange sunburst
    flower** and tassels on each hip; a cream frilled hem;
  - cream lace-up **heeled boots**.
- **Prop**: a thick leather-bound **book** 「宪章」 (`book` ramp: red-brown cover, gold corners)
  held in one hand. For slashing moves she draws a **quill of light** out of the book (a glowing
  orange-gold feather pen, only present during those moves).
- **Fighting style**: precise and economical — palm strikes, book strikes (light jab with the
  spine, heavy two-handed swing), long sweeping kicks that flare the layered skirt and show the
  boots, quill-of-light slashes for `5H`/`2H`/`jH`, `haiku` and `sonnet`. `spark` is cast from
  the open palm with the book floating open beside her; `guardrail` holds the book out as the
  barrier's focus; the `super` opens the book wide in both hands.
- **Silhouette keys**: knee-length straight hair, capelet + wide layered skirt, the book.

### DeepSeek 娘 — 鲸鱼女仆
- Based on the original character 「溟月」 by 上善无形 (CC BY-NC-SA 4.0), redesigned as a maid by
  ZipZipPipe. Clever but a bit lazy, tsundere, quick when she finally moves; loves white rice.
  Soft, curvy build; round friendly face; cheerful open smile with a small fang; fierce when
  attacking.
- **Hair**: long (hip length), **wavy and voluminous**, deep blue at the crown (`hair`) with
  lighter blue inner layers and ends (`hairTip`); a long curled **ahoge**.
- **Whale fins**: a drooping **fin on each side of the head** (like lop ears), dark navy-grey
  with a paler inner face (`fin`).
- **Head**: a white frilled **maid headdress**; a small cyan-blue (`accent`) bow at one side.
- **Eyes**: bright blue (`eye`).
- **Outfit** — classic long maid dress, navy / white with gold details:
  - navy (`cloth2`) dress with puffed shoulders and long sleeves, white frilled cuffs;
  - white blouse front with small buttons; a dark ribbon bow with a blue gem at the collar;
  - fitted navy bodice with two rows of **gold buttons**;
  - white **frilled apron** (waist to knee) with a small navy **whale emblem** (with a spout);
  - **ankle-length skirt**: navy over-skirt open at the front over a lighter-blue pinstriped
    under-skirt (`under`), gold embroidery along both hems, small gold-cream bows, and a white
    frilled petticoat edge;
  - white tights, navy mary-jane shoes.
- **Whale tail**: a large dark navy-grey fluke (`fin` ramp) on a thick tail stock, emerging from
  behind the skirt at hip height and curving up — it sways constantly and is her main heavy weapon.
- **Fighting style**: lazy stance that explodes into fast rush-down — water-wrapped palms and
  hooks, knee and kicks under a lifted skirt hem, **tail swipes** for `5H`/`2H` (spin and lash)
  and `breach` (somersault tail kick). `wave` is a tail slam on the floor; `diveKick` leads with
  both feet, tail streaming behind.
- **Silhouette keys**: voluminous wavy hair with ahoge, head fins + headdress, apron over a wide
  skirt, the big tail.

---------------------------------------------------------------------------------------------------

## V2.2 Proportions and metrics (replaces the sizes in CONTRACT §2.2 / §3.2 / §3.3)

Realistic "arcade fighter" proportions, about 6.5–7 heads tall, at the same 384×216 screen:

| | Claude 娘 | DeepSeek 娘 |
|---|---|---|
| Standing height (ground → top of head) | **104 px** | **98 px** |
| Head height (chin → crown, without ornaments) | ≈ 15–16 px | ≈ 15–16 px |
| Crouch height | ≈ 70 px | ≈ 66 px |
| Body (push) width | ≈ 26 px | ≈ 28 px |
| Walk forward / back | 1.6 / 1.2 px/f | 2.0 / 1.5 px/f |
| Dash / back-dash | 76 px in 18f / 64 px in 20f | 92 px in 16f / 72 px in 18f |
| Jump apex / airtime | 84 px / 44f | 90 px / 44f |
| Reach `5L` / `5M` / `5H` (origin → tip) | 40 / 60 / 72 px | 32 / 50 / 62 px |
| Reach `2L` / `2M` / `2H` | 42 / 62 / 70 px | 34 / 52 / 66 px |
| Reach `jL` / `jM` / `jH` | 36 / 46 / 58 px | 30 / 40 / 48 px |

Ground line stays at y = 186; the head tops are near y ≈ 82–88. Jumping fighters may pass behind
the HUD (as in arcade fighters). Animation names, segment ids and frame counts of §3.3 do not
change.

Faces at this scale are small (head ≈ 13 px wide): design them like arcade sprites — clear hair
shape, a readable eye line with 2–3 px eyes, brows and mouth changes for expressions — and let
the body acting carry the emotion.

---------------------------------------------------------------------------------------------------

## V2.3 Animation quality bar

- Key poses with strong lines of action; real weight shifts (hips, shoulders, counter-rotation);
  attacks drawn through the whole body, not just a limb.
- More drawings where it matters: attacks get anticipation → 1–2 smear/blur frames → impact hold
  → overshoot → settle; idle has breathing, weight shifting, cloth and hair life.
- Cloth is a co-star: the long skirts flare on kicks, trail on dashes, billow on jumps and
  settle afterwards; hair, ribbons, apron strings, whale tail overlap and follow through.
- Smears are shaped (tapered, with a bright edge and a darker trailing edge), never flat bands.

---------------------------------------------------------------------------------------------------

## V2.4 Effects direction

Bigger, bolder, layered — arcade "wow". In particular:

- **Supers are full-screen events.** While a super plays, the whole screen belongs to it: a
  dedicated animated backdrop replaces the stage, the attack itself spans the screen, and the
  ending has a screen-filling finish.
  - Claude 「巨著·万言长卷」: backdrop = a dark study with huge drifting manuscript pages and
    lines of glowing script; the book opens (large, in front of her), a beam ≈ 80 px tall of
    white-gold light crosses the entire screen with dense streaming glyph rows, pages and
    sunburst petals whipping along it, ending in a full-screen sunburst flash.
  - DeepSeek 「深度思考·鲸落」: backdrop = the deep sea rushing up (dark blue-black water,
    light shafts, rising bubbles); a giant whale "R1" (≈ 300×170 px) breaches across the whole
    screen, hangs, and crashes down, pushing a full-width tidal wave across the floor with walls
    of spray.
  - A **super-finish** screen (`screen.superFinish`): when a super KOs, a frozen full-screen
    burst in the winner's colours behind the fighters.
- Specials get signature shapes at larger scale (tall light pillar on `sonnet`, three long ink
  slashes with 五/七/五 seals on `haiku` — the last one crossing half the screen, a taller
  crashing `wave`, a crescent of water on `breach`, a geyser on `dive`).
- Heavy hits and counters: larger impact flashes, speed-line bursts, brief full-screen tint.
- KO: full-screen white-out → radial burst backdrop behind the slow-motion fall.
- Respect `LC.settings.flash === false` (no white-outs, softened tints). No anti-aliasing.

---------------------------------------------------------------------------------------------------

## V2.5 Third fighter: GPT 娘 (`gpt`)

`LC.CHARS` is now `['claude', 'deepseek', 'gpt']`. Palettes: `LC.PAL.gpt` (new slots `scale`,
`wing`, `blob`). Names, bio, dialogue, move names, arcade ladder (`LC.LORE.rivals`,
`LC.LORE.homeStage`, new `LC.LORE.arcade` semantics): the block at the end of
`src/shared/lore.js`. Nothing in any module may assume exactly two fighters any more — iterate
`LC.CHARS`.

### Design (ZipZipPipe's "白发龙娘"; reference art `.shots/ref/gpt-ref.png` — reference only, never
trace, copy pixels or commit it)
- The senior of the cast: regal, composed, a little imperious; cool half-lidded gaze, small
  closed mouth; fierce when attacking. Tall and slender (**102 px** to the top of the head; the
  horns rise ≈ 8 px above that).
- **Hair**: pure white, very long and wavy with loose curls, an ahoge; pointed ears with a drop
  earring.
- **Dragon parts** (`scale` ramp, pale lavender shading): two curved **horns** sweeping up and
  back; a pair of **bat-like wings** at the lower back (`wing` membrane, `scale` bones), normally
  half-folded, spreading on big moves; a long, thick, **scaled tail** with a row of dorsal
  spikes, curling near the floor.
- **Eyes**: pale lavender (`eye`).
- **Outfit** — a white-platinum gown: sleeveless high-collared fitted bodice with a diamond
  cut-out line; **detached, very wide, frilled sleeves** hanging from the upper arms almost to
  the knees; long white skirt with a **high side slit** showing one leg; a platinum **chain belt**
  with diamond pendants and tassels; round **knot rosettes** (an interlaced-loop flower, drawn in
  white with dark line work — our own design, not a logo) in the hair, at the hips and along the
  hem; white heeled shoes with an ankle chain.
- **Companion**: a small round **blue blob** with two eyes floating near her shoulder (`blob`);
  it bobs along in idle and reacts in intro/win/lose.
- **Magic colour**: teal-green and white (`accent`) — her flames, claws' glow and beams — so
  the three fighters read as orange / blue / green.
- **Silhouette keys**: horns, wings, long tail, wide hanging sleeves, slit gown.

### Fighting style and metrics
Power character: slower, hard-hitting, long tail, a command grab. Claw swipes with a teal
after-glow (L), high kicks through the slit (M), tail lashes and wing buffets (H).

| | GPT 娘 |
|---|---|
| Standing / crouch height, body width | 102 / 68 / 28 px |
| Walk forward / back | 1.4 / 1.1 px/f |
| Dash / back-dash | 70 px in 20f / 60 px in 22f |
| Jump apex / airtime | 82 px / 46f |
| Normals startup/active/recovery | 5L 6/3/9 · 5M 9/4/15 · 5H 13/5/24 · 2L 6/3/10 · 2M 9/4/16 · 2H 12/5/25 · jL 5/6/∞ · jM 8/6/∞ · jH 11/6/∞ |
| Reach 5L / 5M / 5H | 36 / 54 / 68 px (5H = tail lash) |
| Reach 2L / 2M / 2H | 38 / 56 / 72 px (2H = tail sweep, knocks down) |
| Reach jL / jM / jH | 32 / 44 / 54 px |

Common animations: the full common set of CONTRACT §3.3 with the same segment ids and frame
counts as Claude's (`dashF` go 20, `dashB` go 22; `super`: startup 6, cast 12, active 50,
recovery 30).

| Move id | Input (simple) | What it is | Animation segments |
|---|---|---|---|
| `breath` | 236+X (`5S`) | 龙息·生成 — a cone of teal-white flame from her mouth, 3 hits, not a travelling projectile. Range L 60 / M 85 / H 110 px. | `breath`: startup 12, active 16, recovery 22 (`muzzle` = mouth) |
| `airBreath` | air 236+X (`jS`) | the same breath aimed 45° down-forward | `airBreath`: startup 10, active 12, recovery* 12 |
| `dragonRise` | 623+X (`6S`) | 升龙·预训练 — rising claw uppercut with wings flared; invulnerable start-up; anti-air; knocks down | `dragonRise`: startup 5, rise 14, fall* 12, land 14 |
| `call` | 214+X (`4S`) | 函数调用 — **command grab**: unblockable, range ≈ 60 px, misses airborne opponents, long whiff recovery. On a catch she carries the victim up on her wings and slams them down (150 / 170 / 190 damage). | `call`: startup 7, active 3, recovery 30 · `callHit`: hold 14, rise 16, slam 12, recovery 22 (`grab` anchor throughout; victim released at the end of `slam`) |
| `roar` | 22+X (`2S`) | 系统提示 — a point-blank roar: shock-wave around her (radius L 56 / M 70 / H 84 px) that blows the opponent away and destroys projectiles. | `roar`: startup 9, active 6, recovery 24 |
| `super` | 236236+X (`H+S`) | 注意力即一切 ATTENTION IS ALL YOU NEED — "multi-head attention": three huge spectral dragon heads descend around the screen and fire beams that converge on the opponent, ending in a full-screen burst. Full-screen, multi-hit, blockable. | `super` as above |

Anchors as CONTRACT §5.3 (`weapon` = claw tip / toe / tail tip of the current attack; `muzzle`
= mouth in `breath`/`airBreath`, raised hand in `super`; `grab` in `throwHit` and `callHit`),
plus `blob` (the companion's position).

### What each module adds for her
- **RIG**: sprite + every animation above (and the common set). 
- **FX** (teal/white/platinum; palette 1 = violet): spawn `gpt.breathCast`, `gpt.riseTrail`,
  `gpt.callSlam` (crater burst + scale shards), `gpt.roarRing`, `gpt.clawHit`, `gpt.scales`;
  sprites `gpt.breath` (flame cone; `opts.length`, `opts.angle`, `opts.phase` 'start'|'loop'|'end'),
  `gpt.attention` (the super: three dragon heads + converging beams + burst; drawn at 0,0 with
  `opts.tx, opts.ty` = target point; `spriteInfo().frames[t]` hit boxes and `events`); and
  `char: 'gpt'` variants of `screen.superBackdrop` (a night sky of drifting attention-matrix
  grids and falling scales), `screen.superFinish`, `screen.koBackdrop`, `screen.superBg`.
- **ILLUST**: `portrait('gpt', …)` for every kind and both palettes; `emblem.gpt` (+ `.lg`): the
  knot rosette.
- **AUDIO**: SFX `gpt.breath`, `gpt.rise`, `gpt.call`, `gpt.callSlam`, `gpt.roar`, `gpt.super`
  (≈ 1.5 s); `voice('gpt', kind)` with her own timbre (cool, regal, lower than the others).
- **FIGHT**: move data, command-grab and roar logic, CPU plans for and against her, move list,
  balance across all six pairings.
- **PLATFORM**: three tiles on character select, the new arcade ladder, move lists for three.

---------------------------------------------------------------------------------------------------

## V2.6 Fourth fighter: Gemini 娘 (`gemini`)

`LC.CHARS` is now `['claude', 'deepseek', 'gpt', 'gemini']`. Palettes: `LC.PAL.gemini` (new slots
`hair2`, `ear`, `eye2`, `lining`, `star`). Names, bio, dialogue, move names and the four-fighter
arcade ladder (`LC.LORE.rivals` now lists three rivals each; `LC.LORE.arcade` has four entries,
`foe: 'rival1' | 'rival2' | 'rival3' | 'mirror'`): the last block of `src/shared/lore.js`.
Everything must work for any roster size — iterate `LC.CHARS`, index rivals generically.

### Design (ZipZipPipe's cat-girl Gemini; reference art `.shots/ref/gemini-ref.png` — reference
only, never trace, copy pixels or commit it)
- Mischievous, playful, quick; a sly closed-mouth smile, finger-to-cheek poses, bouncy on her
  toes; cat-like stretches and pounces. Youthful and a little shorter than the others: **96 px**
  to the top of the head; the ears rise ≈ 8 px above that.
- **Hair**: very long (to the calves), very voluminous and wavy; blue at the crown (`hair`)
  shading to violet (`hair2`) and pink ends (`hairTip`); an ahoge; a small **side bun** with a
  **four-pointed iridescent star clip** (`star`).
- **Cat ears** (blue-violet outside, pink `ear` inside) and a long **fluffy tail** (blue base
  to violet tip) that curls and flicks constantly.
- **Eyes — heterochromia**: one rose-red (`eye`), one gold (`eye2`).
- **Outfit**: navy-indigo (`cloth2`) cropped halter top with star gems, bare midriff;
  **detached wide sleeves** (navy outside, white `cloth1` cuffs, violet `lining`, gold trim);
  a short layered skirt — navy over a white frilled petticoat — with a gold chain belt and star
  pendants; two long **coat-tail panels** hanging from the hips to the calves (navy outside,
  violet lining, a star charm on each tip); a thigh strap; white **leg warmers** and chunky
  navy-violet **platform shoes**.
- **Stars**: two or three small four-pointed iridescent stars drift around her and take part
  in her magic.
- **Magic colour**: pink-violet with iridescent sparkle (`accent`, `star`) — the four fighters
  read as orange / blue / teal-green / violet-pink.
- **Silhouette keys**: cat ears, huge wavy hair, wide sleeves, coat-tail panels, fluffy tail,
  chunky shoes.

### Fighting style and metrics
Trickster: the most mobile fighter, lowest damage per hit, wins with set-ups — a delayed
"twin" that attacks on its own, a teleport, angled projectiles and a **double jump**.
Fast cat-claw swipes (L), nimble kicks with the heavy platform shoes (M), spinning tail-and-heel
attacks (H).

| | Gemini 娘 |
|---|---|
| Standing / crouch height, body width | 96 / 64 / 24 px |
| Walk forward / back | 1.8 / 1.5 px/f |
| Dash / back-dash | 84 px in 16f / 70 px in 18f |
| Jump apex / airtime; **double jump** | 86 px / 44f; one extra jump in the air (≈ 60 px more) |
| Normals startup/active/recovery | 5L 4/3/7 · 5M 7/4/12 · 5H 10/5/20 · 2L 4/3/8 · 2M 7/4/13 · 2H 10/5/22 · jL 4/8/∞ · jM 6/6/∞ · jH 9/6/∞ |
| Reach 5L / 5M / 5H | 30 / 48 / 58 px |
| Reach 2L / 2M / 2H | 32 / 50 / 60 px (2H = sweep, knocks down) |
| Reach jL / jM / jH | 28 / 38 / 46 px |

Common animations: the full common set of CONTRACT §3.3 with DeepSeek's segment ids and frame
counts (`dashF` go 16, `dashB` go 18; `super`: startup 6, cast 12, active 54, recovery 28), plus
`airJump` (go 6: the flip that starts the double jump).

| Move id | Input (simple) | What it is | Animation segments |
|---|---|---|---|
| `star` | 236+X (`5S`) | 星闪 — a four-pointed iridescent star projectile. L: fast, straight. M: flies ≈ 20° upward (catches jumps). H: big, slow, hits twice. One star on screen. | `star`: startup 11, active 3, recovery 24 (`muzzle` = flicking hand) |
| `airStar` | air 236+X (`jS`) | the star thrown 45° down-forward | `airStar`: startup 9, active 3, recovery* 12 |
| `starRise` | 623+X (`6S`) | 双子升星 — rising spinning claw with twin star trails; invulnerable start-up; anti-air; knocks down | `starRise`: startup 4, rise 12, fall* 12, land 14 |
| `twin` | 214+X (`4S`) | 双子·分身 — she leaves a **light-twin** (a translucent pink-violet copy of herself) that claws on its own after a delay. L: where she stands, strikes after ≈ 36f. M: the twin dashes ≈ 110 px forward, then strikes. H: the twin appears **behind the opponent** and strikes after ≈ 44f. One twin at a time; it vanishes if she is hit. Its hit (70 damage) leaves enough stun to combo from. | `twin` (her gesture): startup 10, active 2, recovery 18 · `twinStrike` (performed by the twin): startup 8, active 4, recovery 14 |
| `blink` | 22+X (`2S`) | 闪现 — short teleport, briefly invulnerable. L: ≈ 90 px back. M: ≈ 110 px forward, through the opponent. H: swaps places with her twin if one is out, otherwise up-forward into the air (she can act as she falls). | `blinkOut`: startup 5, vanish 5 · `blinkIn`: appear 5, recovery 9 |
| `super` | 236236+X (`H+S`) | 双子座·流星雨 GEMINI: METEOR SHOWER — she and her twin take opposite sides of the screen, the Gemini constellation lights up overhead, a full-screen rain of iridescent stars comes down, and two beams cross in an X for the finish. Full-screen, multi-hit, blockable. | `super` as above |

Anchors as CONTRACT §5.3 (`weapon` = claw tip / toe / heel / tail tip of the current attack;
`muzzle` = flicking hand in `star`/`airStar`, raised hand in `super`; `grab` in `throwHit`),
plus `tail` and `star` (where her nearest drifting star sits).

### What each module adds for her
- **RIG**: sprite + every animation above (and the common set + `airJump`, `twinStrike`,
  `blinkOut`, `blinkIn`). The twin is the same puppet drawn by the engine with tint/alpha.
- **FX** (pink-violet + iridescent; palette 1 = yellow-green): spawn `gemini.starCast`,
  `gemini.starHit`, `gemini.riseTrail`, `gemini.twinSpawn`, `gemini.twinVanish`,
  `gemini.blinkOut`, `gemini.blinkIn`, `gemini.clawHit`, `gemini.sparkles`; sprites
  `gemini.star` (projectile; `opts.power` 0.3/0.6/1 sizes, `opts.angle`), `gemini.meteor` (the
  super, drawn at 0,0; `opts.ax, opts.ay` = her position, `opts.bx, opts.by` = the twin's;
  `spriteInfo().frames[t]` hit boxes in screen space and `events`); and `char: 'gemini'`
  variants of `screen.superBackdrop` (a deep cosmic sky with the Gemini constellation drawn in
  glowing lines, blue → violet → pink aurora, drifting four-pointed stars), `screen.superFinish`,
  `screen.koBackdrop`, `screen.superBg`, `screen.impact` and the tinted generic effects.
- **ILLUST**: `portrait('gemini', …)` for every kind and both palettes; `emblem.gemini`
  (+ `.lg`): a four-pointed star with two small cat ears.
- **AUDIO**: SFX `gemini.star`, `gemini.starHit`, `gemini.rise`, `gemini.twin`,
  `gemini.twinStrike`, `gemini.blink`, `gemini.super` (≈ 1.5 s); `voice('gemini', kind)` —
  bright, playful, the highest of the four, with a cat-like upward flick.
- **FIGHT**: move data; double jump; the twin entity; blink/swap; star variants; super; CPU plans
  for and against her; move list; balance across all pairings.
- **PLATFORM**: four fighters (+ random) on character select, the four-fight arcade ladder,
  move lists for four.
