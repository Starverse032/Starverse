// LATENT CLASH — PLATFORM screenshot helper for visual review.
// Usage: node tools/platform-shots.mjs [filter] [--page] [--dist]
//   Saves 384×216 canvas captures upscaled ×3 (nearest) to .shots/platform/<name>.png,
//   and with --page full-viewport screenshots (desktop + phones, touch emulated).
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.shots', 'platform');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const filter = args.find(a => !a.startsWith('--')) || '';
const PAGE = args.includes('--page');
const URL = 'file://' + path.join(ROOT, args.includes('--dist') ? 'dist/latent-clash.html' : 'index.html');

// [name, setup(page) -> evaluated in page via string, steps]
const SHOTS = [
  ['boot-gate', `LC.debug.goto('boot')`, 40],
  ['title', `LC.debug.goto('title')`, 90],
  ['menu', `LC.debug.goto('menu')`, 40],
  ['menu-vs', `LC.debug.goto('menu'); LC.debug.step(20); LC.input.setOverride(0,{down:true}); LC.debug.step(1); LC.input.setOverride(0,null); LC.debug.step(2); LC.input.setOverride(0,{L:true}); LC.debug.step(1); LC.input.setOverride(0,null);`, 30],
  ['select-vs', `LC.debug.goto('select', { mode: 'versus', vs: 'pvc' })`, 60],
  ['select-pvp', `LC.debug.goto('select', { mode: 'versus', vs: 'pvp' })`, 80],
  ['select-arcade', `LC.debug.goto('select', { mode: 'arcade' })`, 200],
  ['stage', `LC.debug.goto('stage', {})`, 50],
  ['vs', `LC.debug.goto('vs', { config: LC.app.matchConfig({ mode: 'versus' }) })`, 70],
  ['match', `LC.debug.goto('match', { mode: 'versus', skipIntro: 1 })`, 120],
  ['pause', `LC.debug.goto('match', { mode: 'training' }); LC.debug.step(30); LC.scenes.push('pause', {})`, 20],
  ['result', `LC.debug.goto('result', { cfg: LC.app.matchConfig({ mode: 'versus' }), result: { winner: 0, roundsWon: [2, 1], perfect: false, timeLeft: 31, stats: [{ damage: 1840, maxCombo: 7, hits: 31, specials: 6, supers: 1, throws: 2 }, { damage: 1460, maxCombo: 5, hits: 25, specials: 4, supers: 0, throws: 1 }] } })`, 150],
  ['ladder', `LC.app.newArcade('claude', 0); LC.debug.goto('ladder', {})`, 140],
  ['continue', `LC.app.newArcade('deepseek', 0); LC.debug.goto('continue', {})`, 100],
  ['ending', `LC.app.newArcade('claude', 0); LC.app.session.arcade.score = 123450; LC.debug.goto('ending', {})`, 400],
  ['howto', `LC.debug.goto('howto', {})`, 30],
  ['howto-moves', `LC.debug.goto('howto', { page: 2 })`, 30],
  ['options', `LC.debug.goto('options', {})`, 30],
  ['keys', `LC.debug.goto('keys', {})`, 30],
  ['credits', `LC.debug.goto('credits', {})`, 300],
];

const VIEWPORTS = [
  ['desktop', { viewport: { width: 1280, height: 720 } }],
  ['phone-land', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ['phone-port', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
];

const browser = await chromium.launch();
async function open(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.addInitScript(() => { window.LC_OPTS = { manual: true, mute: true }; });
  await page.goto(URL);
  await page.evaluate(() => LC.debug.ready);
  return { ctx, page, errs };
}
async function grab(page, file) {
  const url = await page.evaluate(() => {
    const src = LC.display.canvas, s = 3, c = document.createElement('canvas');
    c.width = src.width * s; c.height = src.height * s;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
}

const { ctx, page, errs } = await open({ viewport: { width: 1280, height: 720 } });
for (const [name, setup, steps] of SHOTS) {
  if (filter && !name.includes(filter)) continue;
  try {
    await page.evaluate(setup);
    await page.evaluate(n => LC.debug.step(n), steps);
    await grab(page, path.join(OUT, name + '.png'));
    console.log('shot', name, 'scene=' + await page.evaluate(() => LC.debug.scene));
  } catch (e) { console.log('FAILED', name, e.message); }
}
const derr = await page.evaluate(() => LC.debug.errors);
if (derr.length) console.log('LC.debug.errors:', JSON.stringify(derr, null, 1).slice(0, 2000));
if (errs.length) console.log('console:', errs.slice(0, 20).join('\n'));
await ctx.close();

if (PAGE) {
  for (const [vname, opts] of VIEWPORTS) {
    for (const scene of ['menu', 'match']) {
      const o = await open(opts);
      await o.page.evaluate(sc => sc === 'match' ? LC.debug.goto('match', { mode: 'versus', skipIntro: 1 }) : LC.debug.goto(sc), scene);
      await o.page.evaluate(() => LC.debug.step(90));
      await o.page.screenshot({ path: path.join(OUT, `page-${vname}-${scene}.png`) });
      console.log('page', vname, scene, JSON.stringify(await o.page.evaluate(() => { const l = LC.display.layout(); return { scale: l.scale, mode: l.mode, w: l.w, h: l.h }; })));
      if (o.errs.length) console.log(o.errs.slice(0, 10).join('\n'));
      await o.ctx.close();
    }
  }
}
await browser.close();
