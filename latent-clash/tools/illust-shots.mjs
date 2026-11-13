// LATENT CLASH — ILLUST screenshots.  node tools/illust-shots.mjs [group ...]
// Writes .shots/illust/*.png: every asset at x4 (on a dark backdrop, plus a transparent copy for
// portraits), contact sheets, and a full-page shot of dev/illust-gallery.html.
// Groups: all (default) | portraits | claude | deepseek | logo | banners | icons | title | gallery | sheet:<expr>
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.shots', 'illust');
fs.mkdirSync(out, { recursive: true });

const groups = process.argv.slice(2);
if (!groups.length) groups.push('all');
const want = (g) => groups.includes('all') || groups.includes(g);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(path.join(root, 'dev', 'illust-gallery.html')).href + '?shots=1');
await page.waitForFunction(() => window.GAL && window.GAL.ready, null, { timeout: 20000 });

function save(name, dataUrl) {
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
}
async function sheet(name, expr, scale = 4, bg = '#15132a') {
  const url = await page.evaluate(([e, s, b]) => window.GAL.sheet(eval(e), s, b), [expr, scale, bg]);
  save(name, url);
}

const info = await page.evaluate(() => ({ initMs: LC.illust.initMs, names: LC.illust.names() }));
console.log('init ms:', info.initMs && info.initMs.toFixed(1));

for (const g of groups) if (g.startsWith('sheet:')) await sheet('sheet', g.slice(6));

for (const c of ['claude', 'deepseek']) {
  if (!(want('portraits') || want(c))) continue;
  for (const kind of info.names.portraits) {
    for (const pal of [0, 1]) {
      await sheet(`${c}-${kind}-p${pal}`, `[LC.illust.portrait('${c}','${kind}',${pal})]`, 4, '#3b3670');
      if (kind === 'bust' || kind === 'cutin') save(`${c}-${kind}-p${pal}-alpha`, await page.evaluate(([c, k, p]) => window.GAL.raw(LC.illust.portrait(c, k, p), 4), [c, kind, pal]));
    }
  }
  await sheet(`${c}-busts`, `['bust','bustWin','bustLose'].map(k=>LC.illust.portrait('${c}',k,0)).concat(['bust'].map(k=>LC.illust.portrait('${c}',k,1)))`, 3, '#3b3670');
  await sheet(`${c}-busts-light`, `['bust','bustWin','bustLose'].map(k=>LC.illust.portrait('${c}',k,0))`, 3, '#e8e2d4');
}
if (want('portraits')) {
  await sheet('pair-busts', `[LC.illust.portrait('claude','bust',0), LC.illust.portrait('deepseek','bust',0)]`, 4, '#231f45');
  await sheet('faces', `['claude','deepseek'].flatMap(c=>[0,1].map(p=>LC.illust.portrait(c,'face',p)))`, 6, '#231f45');
}
if (want('logo')) {
  await sheet('logo', `[LC.illust.logo()]`, 4, '#15132a');
  await sheet('logo-light', `[LC.illust.logo()]`, 3, '#e8e2d4');
}
if (want('banners')) {
  for (const b of info.names.banners) await sheet('banner-' + b, `[LC.illust.banner('${b}')]`, 3, '#3b3670');
  await sheet('banners', `LC.illust.names().banners.map(b=>LC.illust.banner(b))`, 2, '#3b3670');
}
if (want('icons')) {
  await sheet('icons', `LC.illust.names().icons.map(n=>LC.illust.icon(n))`, 6, '#231f45');
  await sheet('icons-light', `LC.illust.names().icons.map(n=>LC.illust.icon(n))`, 6, '#e8e2d4');
}
if (want('title')) {
  for (const t of [0, 90, 200]) save('title-t' + t, await page.evaluate((t) => window.GAL.titleShot(t, 3), t));
  const ms = await page.evaluate(() => window.GAL.titleBench());
  console.log('title draw ms/frame:', ms.toFixed(3));
}
if (want('gallery') || groups.includes('all')) {
  await page.evaluate(() => window.GAL.full && window.GAL.full());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'gallery.png'), fullPage: true });
}
await browser.close();
if (errors.length) { console.log('CONSOLE ERRORS:'); errors.forEach((e) => console.log('  ' + e)); process.exitCode = 1; }
else console.log('ok, no console errors ->', path.relative(root, out));
