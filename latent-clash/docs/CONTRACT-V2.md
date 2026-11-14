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

Designs by the Bilibili creator **ZipZipPipe**. We draw our own pixel art of these designs (no
copied images); credit lines are already in `LC.LORE.credits`. Colours come from the updated
`LC.PAL` in `src/shared/config.js` (read it — ramps changed).

### Claude 娘 — 橙发优等生
- The class's top student: impeccably mannered, composed, upright posture, a little strict. Calm
  confident face; cool focus when attacking.
- **Hair**: very long (hip length), **straight**, vivid orange (`hair`, ends in `hairTip`), neat
  fringe with long side locks. **Hair ornament**: a flower on the side of her head shaped like a
  radiating sunburst — a ring of ~10–12 tapering orange petals around a small core (it evokes the
  Claude spark mark without copying it).
- **Eyes**: warm amber (`eye`).
- **Outfit**: an elegant **long dress** (ankle length, gently flaring) in cream (`cloth1`) with
  black (`cloth2`) collar, cuffs and waist sash and orange (`accent`) ribbon at the collar and an
  orange band near the hem; black shoes. No jacket/capelet, no pen in hand.
- **Prop**: a thick hardcover **book** 「宪章」 (black cover, orange sunburst emblem, gold clasp)
  carried in the rear hand / under the arm. For slashing moves she draws a **quill of light** out
  of the book (a glowing orange-gold feather pen, only present during those moves).
- **Fighting style**: precise and economical — palm strikes, book strikes (light jab with the
  spine, heavy two-handed swing), long sweeping kicks that flare the skirt, quill-of-light
  slashes for `5H`/`2H`/`jH`, `haiku` and `sonnet`. `spark` is cast from the open palm with the
  book floating open beside her; `guardrail` holds the book out as the barrier's focus; the
  `super` opens the book wide in both hands.

### DeepSeek 娘 — 鲸鱼女仆
- Based on the original character 「溟月」 by 上善无形 (CC BY-NC-SA 4.0), redesigned as a maid by
  ZipZipPipe. Clever but a bit lazy, tsundere, quick when she finally moves; loves white rice.
  Soft, slightly plump build; round friendly face; sleepy-smug default expression, fierce when
  attacking.
- **Hair**: long **gradient blue** hair (deep `hair` blue at the crown shading to cyan `hairTip`
  at the ends), an ahoge, and a **whale fin on each side of the head** (fin-shaped, blue with a
  pale underside, like ears).
- **Eyes**: blue (`eye`).
- **Outfit**: a **navy-and-white long maid dress**: navy (`cloth2`) dress with puffed sleeves and
  long skirt, white (`cloth1`) frilled apron with a small **whale emblem** on the bib, white
  frilled maid headdress, white collar and cuffs, cyan (`accent`) neck ribbon, white stockings,
  dark shoes.
- **Whale tail**: a large blue fluke (hair ramp, pale underside) emerging from under the back of
  the skirt; it sways constantly and is her main heavy weapon.
- **Fighting style**: lazy stance that explodes into fast rush-down — water-wrapped palms and
  hooks, knee and kicks under a lifted skirt hem, **tail swipes** for `5H`/`2H` (spin and lash)
  and `breach` (somersault tail kick). `wave` is a tail slam on the floor; `diveKick` leads with
  both feet, tail streaming behind.

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
