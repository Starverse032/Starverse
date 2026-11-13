#!/usr/bin/env python3
"""LATENT CLASH — bake Fusion Pixel bitmap fonts into src/gen/fontdata.js (PLATFORM).

Usage (from latent-clash/):
    python3 -m venv .venv-platform && .venv-platform/bin/pip install fonttools brotli
    .venv-platform/bin/python tools/platform-bake-font.py [--preview]

How it works
  The Fusion Pixel OTFs are drawn on a strict grid: 1 pixel = 100 font units and every
  outline is made of axis-aligned straight segments on that grid. So instead of letting a
  browser rasterise (and anti-alias) them, we sample every pixel centre against the CFF
  outline with the non-zero winding rule. The result is the designed bitmap, bit for bit.

Output format (all base64, little bit-endian bitstream, see src/platform/font.js):
  chars   : sorted code points, delta-encoded as LEB128 varints
  per size: one bitstream with, for every char in `chars` order:
              adv:5  (31 = glyph missing in this size)
              x:5 (+8 bias)  y:5 (+4 bias, row offset from the line-box top)  w:5  h:5
              w*h pixel bits, row-major
            kern: varint triples (charIndexA, charIndexB, value+16)
"""
import base64, glob, os, re, sys
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'tools', 'fonts', 'fusion-pixel-{}px-proportional-zh_hans.otf.woff2')
OUT = os.path.join(ROOT, 'src', 'gen', 'fontdata.js')
SIZES = (8, 10, 12)
UNIT = 100  # font units per pixel in every Fusion Pixel size

# Characters beyond GB2312 that we always want (GBK symbols, arrows, music note, quotes...).
EXTRA = ('←↑→↓↖↗↘↙↔↕·…—–「」『』（）！？：；，。、～♪♫★☆●○◆◇■□▲△▼▽×÷'
         '‘’“”′″※〜・♥♡✓✗♂♀°±≤≥≠∞√∑π€£¥©®™ⅠⅡⅢⅣⅤ①②③④⑤⑥⑦⑧⑨⑩'
         '〈〉《》【】〔〕〖〗﹏￥％＋－＝＜＞＠＃＆＊／＼｜＾＿｀')


def gb2312_chars():
    out = set()
    for hi in range(0xA1, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                ch = bytes((hi, lo)).decode('gb2312')
            except UnicodeDecodeError:
                continue
            out.add(ch)
    return out


def source_chars():
    """Every non-ASCII char used in the project's sources, so lore / UI text is always covered."""
    out = set()
    pats = ['src/**/*.js', 'src/**/*.html', 'dev/*.html', 'index.html']
    for pat in pats:
        for p in glob.glob(os.path.join(ROOT, pat), recursive=True):
            if p.endswith(os.path.join('gen', 'fontdata.js')):
                continue
            try:
                txt = open(p, encoding='utf-8').read()
            except Exception:
                continue
            for ch in txt:
                if ord(ch) > 0x7E:
                    out.add(ch)
    return out


def rasterize(glyphset, gname):
    pen = RecordingPen()
    glyphset[gname].draw(pen)
    contours, cur = [], []
    for op, args in pen.value:
        if op == 'moveTo':
            if cur:
                contours.append(cur)
            cur = [args[0]]
        elif op == 'lineTo':
            cur.append(args[0])
        elif op in ('closePath', 'endPath'):
            if cur:
                contours.append(cur)
            cur = []
        else:
            raise SystemExit('unexpected outline op %s in %s' % (op, gname))
    if cur:
        contours.append(cur)
    if not contours:
        return None
    xs = [p[0] for c in contours for p in c]
    ys = [p[1] for c in contours for p in c]
    for v in xs + ys:
        if v % UNIT:
            raise SystemExit('off-grid point %s in %s' % (v, gname))
    x0, x1 = min(xs) // UNIT, max(xs) // UNIT
    y0, y1 = min(ys) // UNIT, max(ys) // UNIT  # font y up
    # Edges list for winding computation
    edges = []
    for c in contours:
        n = len(c)
        for i in range(n):
            a, b = c[i], c[(i + 1) % n]
            if a[1] != b[1]:
                edges.append((a[0], a[1], b[0], b[1]))
    rows = []
    for py in range(y1 - 1, y0 - 1, -1):          # top row first
        cy = (py + 0.5) * UNIT
        row = []
        for px in range(x0, x1):
            cx = (px + 0.5) * UNIT
            wn = 0
            for ax, ay, bx, by in edges:
                if ay <= cy < by or by <= cy < ay:
                    t = (cy - ay) / (by - ay)
                    ix = ax + t * (bx - ax)
                    if ix > cx:
                        wn += 1 if by > ay else -1
            row.append(1 if wn != 0 else 0)
        rows.append(row)
    return {'x': x0, 'top': y1, 'w': x1 - x0, 'h': y1 - y0, 'rows': rows}


class Bits:
    def __init__(self):
        self.buf = bytearray()
        self.n = 0

    def put(self, v, nbits):
        for i in range(nbits):
            if self.n % 8 == 0:
                self.buf.append(0)
            if (v >> i) & 1:
                self.buf[self.n >> 3] |= 1 << (self.n & 7)
            self.n += 1


def varint(out, v):
    while True:
        b = v & 0x7F
        v >>= 7
        if v:
            out.append(b | 0x80)
        else:
            out.append(b)
            return


def main():
    preview = '--preview' in sys.argv
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars |= gb2312_chars()
    chars |= set(EXTRA)
    src = source_chars()
    chars |= src
    fonts = {s: TTFont(FONT.format(s)) for s in SIZES}
    cmaps = {s: fonts[s].getBestCmap() for s in SIZES}
    # keep only chars that at least one size has
    chars = sorted(c for c in chars if any(ord(c) in cmaps[s] for s in SIZES))
    index = {c: i for i, c in enumerate(chars)}
    missing_src = sorted(c for c in src if all(ord(c) not in cmaps[s] for s in SIZES) and not c.isspace())
    if missing_src:
        print('warning: chars used in sources but absent from the fonts:', ''.join(missing_src))

    cbytes = bytearray()
    prev = 0
    for c in chars:
        varint(cbytes, ord(c) - prev)
        prev = ord(c)

    sizes_js = []
    glyph_dump = {}
    for s in SIZES:
        f = fonts[s]
        gs = f.getGlyphSet()
        cmap = cmaps[s]
        hmtx = f['hmtx']
        rast = {}
        top_max, bot_min = -99, 99
        for c in chars:
            g = cmap.get(ord(c))
            if g is None:
                continue
            adv = hmtx[g][0]
            if adv % UNIT:
                raise SystemExit('fractional advance %s %s' % (c, adv))
            r = rasterize(gs, g)
            rast[c] = (adv // UNIT, r)
            if r and ord(c) < 0x2500 or (r and 0x4E00 <= ord(c) <= 0x9FFF):
                top_max = max(top_max, r['top'])
                bot_min = min(bot_min, r['top'] - r['h'])
        # Line box = `size` px: CJK sits in rows [size-2 .. -1] around the baseline and
        # Latin descenders reach -2. Rare taller glyphs (accented capitals, box drawing)
        # simply overflow the box; the renderer pads its canvases for them.
        asc, desc = s - 2, 2
        assert bot_min >= -desc, (s, bot_min)
        bits = Bits()
        npresent = 0
        for c in chars:
            if c not in rast:
                bits.put(31, 5)
                continue
            adv, r = rast[c]
            if adv > 30:
                raise SystemExit('advance too large %s' % c)
            bits.put(adv, 5)
            if r is None:
                for _ in range(4):
                    bits.put(0, 5)
                npresent += 1
                continue
            x, y = r['x'] + 8, (asc - r['top']) + 4
            assert 0 <= x < 32 and 0 <= y < 32 and r['w'] < 32 and r['h'] < 32, (c, r['x'], r['top'])
            bits.put(x, 5); bits.put(y, 5); bits.put(r['w'], 5); bits.put(r['h'], 5)
            for row in r['rows']:
                for v in row:
                    bits.put(v, 1)
            npresent += 1
        # kerning restricted to our charset
        kern = bytearray()
        nk = 0
        rev = {v: k for k, v in cmap.items()}
        for lk in f['GPOS'].table.LookupList.Lookup:
            for st in lk.SubTable:
                if getattr(st, 'Format', None) != 1 or not hasattr(st, 'PairSet'):
                    continue
                for g1, ps in zip(st.Coverage.glyphs, st.PairSet):
                    c1 = rev.get(g1)
                    if c1 is None or chr(c1) not in index:
                        continue
                    for pv in ps.PairValueRecord:
                        c2 = rev.get(pv.SecondGlyph)
                        if c2 is None or chr(c2) not in index:
                            continue
                        v = getattr(pv.Value1, 'XAdvance', 0) or 0
                        if v == 0 or v % UNIT:
                            continue
                        varint(kern, index[chr(c1)]); varint(kern, index[chr(c2)]); varint(kern, v // UNIT + 16)
                        nk += 1
        sizes_js.append('    %d: { asc: %d, desc: %d, count: %d,\n      kern: "%s",\n      bits: "%s" }' % (
            s, asc, desc, npresent, base64.b64encode(bytes(kern)).decode(), base64.b64encode(bytes(bits.buf)).decode()))
        print('size %2d: asc %d desc %d, %d/%d glyphs, %d kern pairs, %d bytes' % (s, asc, desc, npresent, len(chars), nk, len(bits.buf)))
        glyph_dump[s] = (asc, desc, rast)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fp:
        fp.write('/* GENERATED by tools/platform-bake-font.py — do not edit.\n'
                 ' * Fusion Pixel Font 8/10/12px proportional zh_hans (c) TakWolf, SIL Open Font License 1.1.\n'
                 ' * %d characters: ASCII, GB2312 (symbols, kana, level-1 + level-2 hanzi), extras. */\n' % len(chars))
        fp.write('(function () {\n  \'use strict\';\n  var LC = window.LC = window.LC || {};\n')
        fp.write('  LC.font = LC.font || {};\n  LC.font.DATA = {\n')
        fp.write('    chars: "%s",\n' % base64.b64encode(bytes(cbytes)).decode())
        fp.write('    sizes: {\n%s\n    }\n  };\n})();\n' % ',\n'.join(sizes_js))
    print('wrote', OUT, os.path.getsize(OUT), 'bytes,', len(chars), 'chars')

    if preview:
        dump_preview(glyph_dump)


def dump_preview(glyph_dump):
    from PIL import Image
    sample = 'Ag中，。「」！？…—←↖★♪あア潜空间激斗LATENT CLASH 0123 jgpqy'
    outdir = os.path.join(ROOT, '.shots', 'platform')
    os.makedirs(outdir, exist_ok=True)
    for s, (asc, desc, rast) in glyph_dump.items():
        lh = asc + desc
        w = sum(rast[c][0] if c in rast else s for c in sample) + 4
        img = Image.new('RGB', (w, lh + 4), (20, 18, 40))
        x = 2
        for c in sample:
            if c not in rast:
                x += s
                continue
            adv, r = rast[c]
            if r:
                for j, row in enumerate(r['rows']):
                    for i, v in enumerate(row):
                        if v:
                            img.putpixel((x + r['x'] + i, 2 + asc - r['top'] + j), (255, 255, 255))
            x += adv
        for i in range(w):
            img.putpixel((i, 2 + asc), (90, 60, 60)) if img.getpixel((i, 2 + asc)) == (20, 18, 40) else None
        img = img.resize((img.width * 8, img.height * 8), Image.NEAREST)
        img.save(os.path.join(outdir, 'font-bake-%d.png' % s))


if __name__ == '__main__':
    main()
