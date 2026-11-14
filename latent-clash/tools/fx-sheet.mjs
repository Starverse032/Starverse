#!/usr/bin/env node
/* LATENT CLASH — FX film strips (owned by FX).
 *
 *   node tools/fx-sheet.mjs                      # every effect + sprite, default frames, bg mid+dark
 *   node tools/fx-sheet.mjs hit. block.          # names containing any of the filters
 *   node tools/fx-sheet.mjs hit.heavy --bg=warm,blue,dark,light --scale=4 --cols=8
 *   node tools/fx-sheet.mjs claude.beam --frames=0,5,10,20,30 --opts='{"palette":1}'
 *   node tools/fx-sheet.mjs --bench              # draw-time benchmark + init time
 *
 * Output: .shots/fx/<name>[ -tag].png — columns = frames 0,1,2,3,4,6,8,10,… (trimmed to the
 * effect's life), rows = backgrounds; each cell is a crop around the spawn point at ×scale.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, '.shots/fx');
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : (args.includes('--' + k) ? true : d); };
const filters = args.filter((a) => !a.startsWith('--'));
const bgs = String(flag('bg', 'mid,dark')).split(',');
const scale = +flag('scale', 3);
const cols = flag('cols') ? +flag('cols') : null;
const opts = flag('opts') ? JSON.parse(flag('opts')) : {};
const tag = flag('tag') ? '-' + flag('tag') : '';
const dummies = !!flag('dummies');
const cellArg = flag('cell') ? String(flag('cell')).split(',').map(Number) : null;   // --cell=w,h[,ox,oy]
const DEFAULT_FRAMES = [0, 1, 2, 3, 4, 6, 8, 10, 12, 15, 18, 22, 26, 30, 36, 44, 52, 60, 70, 80];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(resolve(root, 'dev/fx-viewer.html')).href + '?headless=1');
await page.waitForFunction(() => window.FXV && window.FXV.ready, null, { timeout: 20000 });

if (flag('bench')) {
  const r = await page.evaluate(() => ({ init: window.FXV.initMs, bake: window.LC.fx.stats().bake, bench: [window.FXV.bench(120), window.FXV.bench(120)] }));
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
  process.exit(0);
}

const names = await page.evaluate(() => window.LC.fx.names());
const all = [...names.spawn.map((n) => ({ n, spr: false })), ...names.sprites.map((n) => ({ n, spr: true }))];
const jobs = all.filter((j) => !filters.length || filters.some((f) => j.n.includes(f)));

for (const j of jobs) {
  let frames;
  if (flag('frames')) frames = String(flag('frames')).split(',').map(Number);
  else {
    // trim default frames to the effect's actual life: probe how long it stays alive
    const life = await page.evaluate(({ n, spr, o }) => {
      const FX = window.LC.fx;
      if (spr) { const i = FX.spriteInfo(n); return i && i.duration ? i.duration : 64; }
      FX.clear(); FX.spawn(n, 160, 140, o);
      let t = 0; while (FX.count() > 0 && t < 400) { FX.update(); t++; }
      FX.clear(); return t;
    }, { n: j.n, spr: j.spr, o: opts });
    frames = DEFAULT_FRAMES.filter((f) => f <= life + 1);
    if (life > 80) frames = frames.concat([100, 130, 160, 200, 260, 330].filter((f) => f <= life + 1));
  }
  const url = await page.evaluate((o) => window.FXV.strip(o), { name: j.n, x: flag('x') ? +flag('x') : undefined, frames, bgs, scale, cols: cols || Math.min(frames.length, 10), opts, dummies, cell: cellArg ? { w: cellArg[0], h: cellArg[1], ox: cellArg[2] || 0, oy: cellArg[3] != null ? cellArg[3] : cellArg[1] / 2 } : null });
  const file = resolve(outDir, j.n + tag + '.png');
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', file.replace(root + '/', ''), 'frames', frames.join(','));
}
if (errors.length) console.log('console errors/warnings:\n' + errors.join('\n'));
await browser.close();
