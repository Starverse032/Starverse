# ILLUST — notes

## Gemini progress / next steps (V2.6 fourth fighter — truthful, current)
- core.js: slots appended (old indices unchanged): `g0..g3,gK` = `eye2`, `q0..q3` = `star` hues;
  for gemini `x*` = `hair2`, `u*` = `lining`, `z*` = `ear` (fallback chains; other chars unchanged).
- tools/illust-hash.mjs: `save` / `check` pixel hashes of the other chars' portraits, icons, banners,
  logo, title (baseline in `.shots/illust/hash-baseline.json`).
- gemini.js (manifest: after gpt.js) — registered, renders with zero console errors:
  bust / bustWin (wink, peace sign, light-twin silhouette, stars) / bustLose (flattened ears, teary
  pout, "?" + drooping star, limp tail, arm lowered) / face (hand map) / cut-in hooks / `emblem` hook.
  `hairShift()` = blue → violet → pink in 3-step dithered bands by a diagonal wavy field; `star4()` =
  faceted iridescent four-pointed star; `catEar()`, furry `tail()`, `twin()`.
- icons.js: generic `I.ART[c].emblem(P, size)` hook before the whale fallback; api.js ICONS +
  `emblem.gemini(.lg)`. cutin.js untouched (uses the generic cutinFace/Motif/Over hooks).
- IN PROGRESS: review of cut-in / face / emblem, then a bust refinement round.

## GPT progress / next steps (V2.5 third fighter — truthful, current)
DONE (zero console errors; init ≈ 430 ms with three chars; Claude/DeepSeek art, emblems, logo, banners
and title verified pixel-identical to the pre-GPT baseline):
- core.js: slots appended (old indices unchanged): `z0..z3,zl` = `blob` ramp; for gpt `x*` = `scale`,
  `u*` = `wing` (old chars keep book/fin, under/cloth1; `z*` falls back to accent).
- gpt.js (manifest: after deepseek.js): bust / bustWin / bustLose / face / cut-in hooks / emblem.
  Bust: half-lidded lavender eyes, small mouth, long wavy white hair (clumps + escaping curls),
  ahoge, two ribbed horns sweeping up-back (`horn()`: scale ramp, curved chevron ridges), pointed ear
  + platinum/teal drop earring, knot rosette + tassel at the far horn root, high collar with clasp,
  sleeveless bodice with diamond cut-out + diamond studs, princess seams, near detached sleeve top,
  far frilled sleeve hanging from the raised arm, bracelet, beckoning hand (crooked index finger aimed
  at the blob — deliberately NOT vertical: a lone upright finger reads as a rude gesture at 1×),
  bat wing behind the near shoulder, blue blob companion. Win: closed smug eyes, smirk, blob cheering
  (arms up) + sparkles. Lose: wide teary eyes, worried brows, wavy mouth, hatch blush, sweat, teal
  "regenerate ⟳" arrow, wing drooped, arm lowered, blob dizzy with orbiting stars.
- `knot()` rosette: ≥ 32 px = 5 woven cord rings (over at the rim, under near the centre); small =
  scalloped loops + hole dots (the weave turns into a pinwheel at small sizes — avoid). 5 loops, not 6,
  to stay clear of any hexagonal logo look. Emblem gets a teal gem core (orange / blue / green set).
- face 24×24: hand-typed map. Cut-in: cutin.js generic hooks `I.ART[c].cutinCfg/cutinMotif/
  cutinFace/cutinOver` (old branches untouched); GPT = dragon-scale crescents, teal flame tongues,
  narrowed glowing eyes with glint streaks, far horn in the face layer, near horn drawn over the
  finished band so it breaks the slanted cut and the top rule.
- icons.js: `emblem.<char>` regex generalised (any LC.PAL char); api.js ICONS + `emblem.gpt(.lg)`.
- tools/illust-shots.mjs: iterates LC.CHARS (`gpt` group), `trio-busts(-light)` sheets, `SCALE=n` for `sheet:`.
WEAK / NEXT:
- Face icon horns are 2–3 px and can read as antennae; bust rosette at ~15 px is a "white flower
  with holes", the weave only shows at 32 px. Bodice is plain next to the others' busier outfits.
- Front locks still slightly ribbon-like (same weakness as DeepSeek); hand is small.
- Title key art still shows only Claude vs DeepSeek (not in this brief).

## V2 progress / next steps (ZipZipPipe redesign — truthful, current)
DONE (all render with zero console errors; init ≈ 340–390 ms, up from ≈ 260; title 0.1 ms/frame):
- core.js: new slots `x0..x3,xl` (Claude `book` / DeepSeek `fin`), `u0..u3,ul` (DeepSeek `under`, not
  used yet), `eK` (dark iris rim), `xP` (pale fin inner face = fin[0] mixed with white).
- claude.js: bust / bustWin (closed-eye smile, sparkles) / bustLose (heavy lids, eye bags, sweat, stray
  strands, empty battery gauge). Orange straight hair curtain out of frame, parted fringe + strand between
  the eyes, level brows drawn through the fringe, sunburst flower + black bow + cream tassel (near side),
  high frilled collar, black cravat + sunburst brooch, 4-tier jabot, gold-edged capelet + emblem, red-brown
  book with gold corners held up by her far hand. Face icon redrawn.
- deepseek.js: bust / bustWin (wink, big grin, thumbs-up, floating rice bowl) / bustLose (spiral eyes,
  wavy mouth, "server busy" spinner, hand lowered). Wavy hair with light-blue inner layer, lop-ear fins
  (outlined, pale inner face), frilled headdress + cyan bow, open curled ahoge, navy dress with puffed
  shoulders, white blouse + dark bow + blue gem, frilled apron straps, gold buttons, waving hand. Face redrawn.
- cutin.js (NEW, after title.js in the manifest; the old crop-the-bust cut-in was removed from title.js):
  native 1× close-ups — each char file exports `I.ART[c].head` ({FR, face, skull}); the cut-in redraws
  that geometry at ×2.8 via the painter transform, with vector eyes `I.bigEye(P, {x,y,w,h}, near, {lid,
  fierce})`, angled brows, motif (Claude sunburst rays / DeepSeek water rings), speed lines, slanted cut.
- icons.js: `emblem.claude(.lg)` is now the sunburst flower; whale emblem unchanged (fits: navy whale +
  spout, like her apron emblem). logo.js: top-left accent is now the sunburst flower.
- title.js: composition checked with the new busts — no change needed (DeepSeek mirrored waves toward
  the core; nothing intrudes into the logo area).
WEAK / NEXT (if there is budget):
- Claude's near face-framing lock and DeepSeek's wavy locks are still a bit "ribbon-like"; hair could use
  more clump breakup and fewer dark separation lines. DeepSeek's crown lacks fluffy volume.
- No whale tail in DeepSeek's bust (optional per brief). `u*` (under-skirt) slots unused in portraits.
- Faces 24×24 are serviceable hand maps, not polished.

## Progress (V1, historical)
- Done: every API of contract §5.5 — portraits (face/bust/bustWin/bustLose/cutin × both chars × 2 palettes),
  logo, all 17 banners, all 27 icons, animated title key art. Zero console errors; init ≈ 240–280 ms;
  `drawTitle` ≈ 0.1 ms/frame.
- Polish still worth doing (not done): 24×24 faces are crude hand maps; DeepSeek pigtails read a bit
  "tube + fin"; hands (Claude's fist, DeepSeek's glove) are blocky; 16×16 Claude emblem is thin;
  title figures are the busts re-used (no new poses); cut-ins reuse the bust eyes at 2× (no new
  large-eye drawing).

## How it works
- `core.js` — tiny "pixel vector" toolkit. Shapes (polygons, smooth blobs, ellipses, tapered bezier
  ribbons `sr(points, w0, w1, wm, tStart, tEnd)`) are rasterised with pixel-centre sampling (no AA)
  into `Mask`s; masks are painted into a `Painter` holding **palette slots** (`K.S`: `h0..h3` hair,
  `s0..s3` skin, `e*` eye, `c*` cloth1, `d*` cloth2, `a*` accent, `m*` metal, derived line colours
  `hl/sl/cl/dl/al/ml`, …). `K.slotColors(char, pal)` maps slots to `LC.PAL[char][pal]` (derived tones
  are mixes of palette colours), so palette swaps are exact. `part()` = fill + 1-px line on the
  shape's own boundary (inner lines between layers); `recol(mask, from, to)` = clipped cel shading;
  `band(dx,dy)` = edge band for light/shade; `outer()` = dark coloured silhouette outline pass;
  `map()` stamps hand-typed pixel maps (eyes, mouths, faces).
- `claude.js` / `deepseek.js` — busts drawn back-to-front: back hair clumps → body/clothes →
  skull → face → eye/mouth maps (per expression) → fringe (cast shadow first) → side locks → clips →
  props → outline → accents. Light: upper right (she faces right). `hairClump()` = ribbon + shade
  band + lit edge + optional shine streak + cream/cyan tip (`tipMap`, dithered transition).
  Expressions: `drawBust(P, {expr: 'n'|'win'|'lose'|'cut', sway, noPen})`.
  To tweak: edit the point lists (coordinates are bust pixels, 112×128) or the eye maps (`EYES`).
- `type.js` — arcade block font on a 5×7 grid (cells `#` + four 45° half-cells `b d p q`), any cell
  size, italic shear, banded fills (`T.STYLES`: gold/fire/ice/silver/red/p1/p2/dusk), bevel, 2-ring
  outline, drop shadow or solid extrusion. Banners are assembled in `wordsFor()`.
- `logo.js` — 潜空间激斗 as stroke polylines on a 20-unit grid (2 px/unit, square caps), fire-gold
  chrome with 3-px extrusion; LATENT CLASH in the banner font on a split orange/blue plate; orange
  starburst (top-left) and blue whale fluke (top-right) accents.
- `icons.js` — hand-typed maps with explicit colour legends; arrows are one straight + one diagonal
  map rotated/flipped; emblems are vector (palette-0 colours).
- `title.js` — `I.TITLE` (pre-rendered layers in `init`). `cutin.js` — `I.cutin(char)`, `I.bigEye`.

## Assets, sizes, anchors
| asset | size | notes |
|---|---|---|
| `portrait(c,'bust'/'bustWin'/'bustLose',p)` | 112×128 | facing right, transparent; head centre ≈ (54, 44); bottom edge is a crop (no outline) |
| `portrait(c,'cutin',p)` | 240×72 | **opaque band** (deep accent colour, character motif, speed lines streaming left, light top/bottom rule); native 1× pixels (V2); face sits right of a slanted cut at x ≈ 62–80, the left ~62 px is free for the move name. Mirror it yourself for P2 if wanted. |
| `portrait(c,'face',p)` | 24×24 | head-and-shoulders, transparent bg |
| `logo()` | 240×90 | transparent |
| `banner(...)` | ≤ 64 tall, 180–284 wide: `fight` 262×64, `ko` 196×64, `round1` 214×57, `finalRound` 260×36, `doubleKo` 279×50, `youLose` 284×50, `vs` 124×64, `counter` 89×18 | transparent, include shadow; centre them |
| `icon('btn.*'/'dir.*'/'cursor'/'lock'/'touch')` | 12×12 | |
| `icon('emblem.*')` / `'.lg'` | 16×16 / 32×32 | |
| `icon('pip.on'/'pip.off')` | 10×10 | |
| `icon('keyboard'/'gamepad')` | 16×12 | |
| `icon('p1'/'p2'/'cpu')` | 13×9 / 13×9 / 17×9 | pill tags |
| `drawTitle(ctx,t)` | full 384×216 | logo area (x 72–312, y 8–100) and bottom prompt line (y ≈ 186–200, centre) kept clear |

## Additions beyond the contract
- `LC.illust.names()` → `{ portraits, banners, icons }`; `LC.illust.render(char, pic, pal, flip)`;
  `LC.illust.portraitPic(char, kind)` (indexed picture); `LC.illust.kit` (toolkit);
  `LC.illust.initMs`; `I.ART[char].titleFrame({sway})`.
- Unknown names never throw: `console.error('[illust] …')` once and a blank canvas of a sensible size.

## Deviations
- Title figures are the two busts (DeepSeek mirrored), with 3 pre-rendered hair-sway frames each.

## Tools
- Gallery: open `dev/illust-gallery.html` (file:// works): palette toggle, ×1/×2/×4, dark/mid/light
  backgrounds, title animating with logo overlaid, banners over a mock gameplay backdrop.
- Shots: `node tools/illust-shots.mjs [all|portraits|claude|deepseek|gpt|logo|banners|icons|title|gallery|sheet:<expr>]`
  → `.shots/illust/*.png` (×4 assets, contact sheets, gallery page, title frames; prints init ms,
  title ms/frame and any console errors).
