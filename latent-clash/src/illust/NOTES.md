# ILLUST — notes

## Progress (truthful, current)
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
- `title.js` — `I.cutin(char)` and `I.TITLE` (pre-rendered layers in `init`).

## Assets, sizes, anchors
| asset | size | notes |
|---|---|---|
| `portrait(c,'bust'/'bustWin'/'bustLose',p)` | 112×128 | facing right, transparent; head centre ≈ (54, 44); bottom edge is a crop (no outline) |
| `portrait(c,'cutin',p)` | 240×72 | **opaque band** (deep accent colour + speed lines streaming left, light top/bottom rule); face sits in x ≈ 60–228, the left ~60 px is free for the move name. Uniform 2× chunky pixels (allowed for super cut-ins, §2.3). Mirror it yourself for P2 if wanted. |
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
- Cut-in is an opaque band at 2× chunky pixels (re-cropped bust eyes with determined brows), not a
  separately drawn native-resolution close-up.
- Title figures are the two busts (DeepSeek mirrored), with 3 pre-rendered hair-sway frames each.

## Tools
- Gallery: open `dev/illust-gallery.html` (file:// works): palette toggle, ×1/×2/×4, dark/mid/light
  backgrounds, title animating with logo overlaid, banners over a mock gameplay backdrop.
- Shots: `node tools/illust-shots.mjs [all|portraits|claude|deepseek|logo|banners|icons|title|gallery]`
  → `.shots/illust/*.png` (×4 assets, contact sheets, gallery page, title frames; prints init ms,
  title ms/frame and any console errors).
