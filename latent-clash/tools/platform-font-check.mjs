// LATENT CLASH — verify the baked font against Chromium's own rasterisation of the woff2 (PLATFORM).
// Fusion Pixel outlines lie on a 1-px grid, so at the native px size Chromium's coverage is exactly
// 0 or 1 per pixel; we render sample strings both ways and compare the masks pixel for pixel.
// Usage: node tools/platform-font-check.mjs   (writes .shots/platform/font-check-*.png)
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.shots', 'platform');
fs.mkdirSync(OUT, { recursive: true });

const SAMPLES = [
  'LATENT CLASH 0123456789 12:34 a:b jgpqy AVAWToTyfi',
  '潜空间激斗！点击画面，按任意键开始。',
  '「打得很精彩！」『巨著·万言长卷』（深度思考）……——～',
  '←↑→↓↖↗↘↙★☆●○◆■▲▼×÷♪ あいうえお アイウエオ',
  '温柔又认真的文学少女。习惯先思考再出手，喜欢俳句、十四行诗和长篇巨著。',
  '元气满满、直来直去的理科少女。西湖醋鱼（？）、开源社区、凌晨三点的灵感',
  // informational: rare GB2312 hanzi absent from the 10/12 px sources (browser shows a system
  // fallback font; we borrow the glyph from another size or draw a box), never counted as failure
  '饔髹麇黧鼗鼢鼷彘悫桊棼橼炱瘛磙秭絷繇芪茚莜莸蓥蕹蘧衮褰襻觳躞郄銎',
];
const INFO_ONLY = SAMPLES.length - 1;

const html = `<!doctype html><meta charset="utf-8"><style>
${[8, 10, 12].map(s => `@font-face{font-family:FP${s};src:url("file://${ROOT}/tools/fonts/fusion-pixel-${s}px-proportional-zh_hans.otf.woff2") format("woff2")}`).join('\n')}
</style><body></body>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const tmp = path.join(OUT, 'font-check.html');
fs.writeFileSync(tmp, html + `<script src="file://${ROOT}/src/shared/config.js"></script>
<script src="file://${ROOT}/src/gen/fontdata.js"></script><script src="file://${ROOT}/src/platform/font.js"></script>`);
await page.goto('file://' + tmp);
await page.evaluate(() => document.fonts.ready);
await page.evaluate(async () => { for (const s of [8, 10, 12]) await document.fonts.load(`${s}px FP${s}`, '中A'); });

const res = await page.evaluate(async (SAMPLES) => {
  await LC.font.init();
  const out = [];
  for (const size of [8, 10, 12]) {
    for (const [si, text] of SAMPLES.entries()) {
      const W = 640, H = size + 8;
      const a = document.createElement('canvas'); a.width = W; a.height = H;
      const ca = a.getContext('2d');
      ca.font = `${size}px FP${size}`; ca.fillStyle = '#fff'; ca.textBaseline = 'alphabetic';
      ca.fillText(text, 2, 4 + size - 2);
      const b = document.createElement('canvas'); b.width = W; b.height = H;
      const cb = b.getContext('2d');
      LC.font.draw(cb, text, 2, 4, { size, color: '#fff' });
      const da = ca.getImageData(0, 0, W, H).data, db = cb.getImageData(0, 0, W, H).data;
      let diff = 0, partial = 0, firstX = -1;
      const cmp = document.createElement('canvas'); cmp.width = W; cmp.height = H * 3 + 4;
      const cc = cmp.getContext('2d'); cc.fillStyle = '#141228'; cc.fillRect(0, 0, W, cmp.height);
      const id = cc.getImageData(0, 0, W, cmp.height);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, A = da[i + 3], B = db[i + 3];
        if (A > 0 && A < 255) partial++;
        const ma = A > 127, mb = B > 127;
        const put = (yy, c) => { const j = (yy * W + x) * 4; id.data[j] = c[0]; id.data[j + 1] = c[1]; id.data[j + 2] = c[2]; id.data[j + 3] = 255; };
        if (ma) put(y, [255, 255, 255]);
        if (mb) put(y + H + 2, [255, 255, 255]);
        if (ma !== mb) { diff++; if (firstX < 0) firstX = x; put(y + 2 * H + 4, ma ? [255, 80, 80] : [80, 160, 255]); }
      }
      cc.putImageData(id, 0, 0);
      out.push({ size, si, diff, partial, firstX, png: cmp.toDataURL() });
    }
  }
  return out;
}, SAMPLES);

let bad = 0;
for (const r of res) {
  const tag = `size ${r.size} sample ${r.si}: diff ${r.diff} px, browser partial-coverage px ${r.partial}` + (r.diff ? ` (first at x=${r.firstX})` : '');
  console.log(tag);
  if (r.diff && r.si !== INFO_ONLY) bad++;
  if (r.si < 4 || r.diff) fs.writeFileSync(path.join(OUT, `font-check-${r.size}-${r.si}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
}
fs.unlinkSync(tmp);
await browser.close();
console.log(bad ? `${bad} sample(s) differ` : 'all samples pixel-identical');
process.exit(bad ? 1 : 0);
