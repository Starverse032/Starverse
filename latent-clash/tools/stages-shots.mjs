// LATENT CLASH — STAGE screenshots: node tools/stages-shots.mjs [stageId ...] [--quick] [--bench]
//
// Writes to .shots/stages/:
//   <id>-cam{0,128,256}.png  ×3, with dummy fighters (readability check)
//   <id>-clean.png           ×3, camX 128, no dummies
//   <id>-thumb.png           stage-select thumbnail (96×54) at ×3
//   <id>-timelapse.png       4 frames 1 s apart (2×2 grid, ×2) to show the ambient animation
//   <id>-event.png           ×2 frames a few ticks after 'hit' / 'super' events
// --quick: only cam128 + timelapse.  --bench: also print draw timings and gap checks.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import url from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, '.shots', 'stages');
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const bench = args.includes('--bench');
const only = args.filter((a) => !a.startsWith('--'));

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(url.pathToFileURL(path.join(ROOT, 'dev', 'stages-viewer.html')).href + '?shots=1');
await page.waitForFunction(() => window.STV && window.STV.ready, null, { timeout: 20000 });

const save = (name, dataUrl) => fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
const ids = await page.evaluate(() => STV.ids);
console.log('init (all stages):', (await page.evaluate(() => STV.initMs)).toFixed(0), 'ms', JSON.stringify(await page.evaluate(() => STV.buildTimes()), (k, v) => typeof v === 'number' ? Math.round(v) : v));

for (const id of ids) {
  if (only.length && !only.includes(id)) continue;
  const cams = quick ? [128] : [0, 128, 256];
  for (const camX of cams) save(`${id}-cam${camX}.png`, await page.evaluate((o) => STV.render(o), { stage: id, camX, t: 120, lane: true, scale: 3 }));
  if (!quick) {
    save(`${id}-clean.png`, await page.evaluate((o) => STV.render(o), { stage: id, camX: 128, t: 120, lane: false, scale: 3 }));
    save(`${id}-thumb.png`, await page.evaluate((o) => STV.thumb(o, 3), id));
    // event frames
    const ev = await page.evaluate((id) => {
      const evs = [[100, 'hit', { x: 300, power: 1 }], [160, 'super', { side: 0 }]];
      return [STV.render({ stage: id, camX: 128, t: 108, events: evs, scale: 2 }), STV.render({ stage: id, camX: 128, t: 168, events: evs, scale: 2 })];
    }, id);
    save(`${id}-event-hit.png`, ev[0]); save(`${id}-event-super.png`, ev[1]);
  }
  // time-lapse: 4 frames, 60 ticks apart, 2×2 grid at ×2
  const frames = [];
  for (let i = 0; i < 4; i++) frames.push(await page.evaluate((o) => STV.render(o), { stage: id, camX: 96 + i * 20, t: 60 + i * 60, lane: false, scale: 2 }));
  const grid = await page.evaluate(async (frames) => {
    const c = document.createElement('canvas'); c.width = 768 * 2 + 4; c.height = 432 * 2 + 4;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 4; i++) {
      const im = new Image(); im.src = frames[i]; await im.decode();
      g.drawImage(im, (i % 2) * 772, (i >> 1) * 436);
    }
    return c.toDataURL('image/png');
  }, frames);
  save(`${id}-timelapse.png`, grid);
  if (bench) {
    const r = await page.evaluate((id) => STV.bench(id, 600), id);
    const gaps = [];
    for (const cam of [0, 256]) for (const sh of [[-8, -8], [8, 8], [-8, 8], [8, -8]]) gaps.push(await page.evaluate((a) => STV.gaps(a[0], a[1], a[2]), [id, cam, sh]));
    console.log(`${id}: draw avg ${r.avg.toFixed(3)} ms max ${r.max.toFixed(3)} ms · uncovered px under ±8 shake: ${gaps.join(',')}`);
  }
  console.log('shot', id);
}
if (errors.length) console.log('CONSOLE:\n' + errors.join('\n'));
await b.close();
