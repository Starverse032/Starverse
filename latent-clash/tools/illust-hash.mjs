// LATENT CLASH — ILLUST regression check.  node tools/illust-hash.mjs [save|check] [chars...]
// Hashes every portrait / icon / banner / logo canvas (+ title frames) of the given characters
// (default: all except gemini) and saves them to .shots/illust/hash-baseline.json (save) or compares
// against that file (check) — proves shared-code edits leave existing art pixel-identical.
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, '.shots', 'illust', 'hash-baseline.json');
const mode = process.argv[2] || 'check';
const only = process.argv.slice(3);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(path.join(root, 'dev', 'illust-gallery.html')).href + '?shots=1');
await page.waitForFunction(() => window.GAL && window.GAL.ready, null, { timeout: 20000 });
const hashes = await page.evaluate((only) => {
  function h(cv) {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let a = 2166136261 >>> 0;
    for (let i = 0; i < d.length; i++) { a ^= d[i]; a = Math.imul(a, 16777619) >>> 0; }
    return cv.width + 'x' + cv.height + ':' + a.toString(16);
  }
  const I = LC.illust, out = {}, n = I.names();
  const chars = only.length ? only : LC.CHARS.filter((c) => c !== 'gemini');
  chars.forEach((c) => n.portraits.forEach((k) => [0, 1].forEach((p) => { out[c + ':' + k + ':' + p] = h(I.portrait(c, k, p)); })));
  n.icons.filter((x) => !/gemini/.test(x)).forEach((x) => { out['icon:' + x] = h(I.icon(x)); });
  n.banners.forEach((x) => { out['banner:' + x] = h(I.banner(x)); });
  out.logo = h(I.logo());
  [0, 90, 200].forEach((t) => {
    const cv = document.createElement('canvas'); cv.width = LC.W; cv.height = LC.H;
    I.drawTitle(cv.getContext('2d'), t); out['title:' + t] = h(cv);
  });
  return out;
}, only);
await browser.close();
if (mode === 'save') {
  fs.writeFileSync(file, JSON.stringify(hashes, null, 1));
  console.log('saved', Object.keys(hashes).length, 'hashes');
} else {
  const base = JSON.parse(fs.readFileSync(file, 'utf8'));
  const diff = Object.keys(base).filter((k) => base[k] !== hashes[k]);
  console.log(diff.length ? 'CHANGED: ' + diff.join(', ') : 'OK: all ' + Object.keys(base).length + ' baseline hashes identical');
}
if (errors.length) console.log('console errors:', errors.slice(0, 8).join(' | '));
