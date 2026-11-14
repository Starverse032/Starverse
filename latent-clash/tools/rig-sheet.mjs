#!/usr/bin/env node
/* LATENT CLASH — RIG contact sheets (Playwright).
 *
 *   node tools/rig-sheet.mjs                       # everything: per-anim rows, overviews, palettes, versus
 *   node tools/rig-sheet.mjs claude idle           # one anim (8 evenly sampled frames)
 *   node tools/rig-sheet.mjs claude idle 0         # every frame
 *   node tools/rig-sheet.mjs claude idle 8 --pal 1 --scale 6 --anchors --mirror
 *   node tools/rig-sheet.mjs --overview            # one pose of every anim, both chars
 *   node tools/rig-sheet.mjs --palettes | --versus [animA animB]
 *   node tools/rig-sheet.mjs --perf                # draw/init timings
 *
 * Output: latent-clash/.shots/rig/*.png  (×4 nearest-neighbour by default)
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.shots', 'rig');
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['pal', 'scale', 'cols', 'name'].includes(args[i - 1].slice(2))));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto('file://' + path.join(ROOT, 'dev', 'rig-sheet.html'));
await page.evaluate(() => window.sheetReady);

async function save(name, expr, ...a) {
  const url = await page.evaluate(([expr, a]) => {
    const c = window[expr](...a);
    return c ? c.toDataURL('image/png') : null;
  }, [expr, a]);
  if (!url) { console.log('skip', name); return; }
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', path.relative(ROOT, file));
}

const pal = +opt('pal', 0), scale = +opt('scale', 4);
const chars = await page.evaluate(() => Object.keys(LC.rig._.CHARS));

if (flag('reach')) {
  // node tools/rig-sheet.mjs --reach [char]  → weapon anchor (x,y) over each attack's active frames
  const c = pos[0] || 'claude';
  const r = await page.evaluate((c) => {
    const p = LC.rig.createPuppet(c, { palette: 0 }), out = {};
    LC.rig.listAnims(c).forEach((nm) => {
      const info = LC.rig.animInfo(c, nm); let acc = 0;
      info.segs.forEach((s) => {
        if (/^(active|hit\d|rise)$/.test(s.id)) {
          const v = [];
          for (let f = 0; f < s.f; f++) { p.setPose(nm, acc + f); const a = p.getAnchor('weapon'); v.push(a.x + ',' + a.y); }
          out[nm + '.' + s.id] = v.join(' ');
        }
        acc += s.f;
      });
    });
    return out;
  }, c);
  Object.keys(r).forEach((k) => console.log(k.padEnd(22), r[k]));
} else if (flag('perf')) {
  const r = await page.evaluate(() => {
    const res = { initMs: LC.rig.stats.initMs };
    const out = document.createElement('canvas'); out.width = 384; out.height = 216;
    const g = out.getContext('2d');
    Object.keys(LC.rig._.CHARS).forEach((cid) => {
      const p = LC.rig.createPuppet(cid, { palette: 0 });
      const names = LC.rig.listAnims(cid);
      // worst case: re-render every frame (pose changes every frame)
      let t0 = performance.now(), n = 0, x = 0;
      for (let k = 0; k < 3; k++) names.forEach((nm) => {
        const info = LC.rig.animInfo(cid, nm);
        for (let f = 0; f < info.total; f++) { p.setPose(nm, f); x += 1; p.tick({ x, y: 0, vx: 1, vy: 0, facing: (f & 32) ? -1 : 1 }); p.draw(g, 100, 186, { facing: (f & 32) ? -1 : 1, flash: (f % 10 === 0) ? 0.6 : 0 }); n++; }
      });
      res[cid + '_drawMs'] = (performance.now() - t0) / n;
      // anchors: determinism + no canvas
      t0 = performance.now(); let m = 0, h = 0;
      names.forEach((nm) => { const info = LC.rig.animInfo(cid, nm); for (let f = 0; f < info.total; f++) { p.setPose(nm, f); const a = p.getAnchor('weapon'); h = (h * 31 + a.x * 7 + a.y) | 0; m++; } });
      res[cid + '_poseAnchorUs'] = (performance.now() - t0) / m * 1000;
      res[cid + '_anchorHash'] = h;
      res[cid + '_renders'] = LC.rig.stats.renders;
    });
    return res;
  });
  console.log(JSON.stringify(r, null, 1));
} else if (flag('overview') || pos.length === 0 && !flag('palettes') && !flag('versus')) {
  for (const c of chars) {
    await save(`${c}-overview-p0`, 'sheetOverview', c, 0, 3, 10);
    if (pos.length === 0 && !flag('overview')) await save(`${c}-overview-p1`, 'sheetOverview', c, 1, 3, 10);
  }
  if (pos.length === 0 && !flag('overview')) {
    for (const c of chars) {
      const names = await page.evaluate((c) => LC.rig.listAnims(c).filter((n) => !LC.rig.animInfo(c, n).placeholder), c);
      for (const n of names) await save(`${c}-${n}`, 'sheetAnim', c, n, 0, 4, { anchors: false });
      await save(`${c}-palettes`, 'sheetPalettes', c, ['idle', 'walkF', '5H', 'hitHigh', 'win'], 4);
    }
    await save('versus', 'sheetVersus', 'idle', 'idle', 3);
  }
} else if (flag('multi')) {
  // node tools/rig-sheet.mjs --multi <char> anim:f,f,f anim2:f,f [--name x]
  const [c, ...rest] = pos;
  const spec = rest.map((t) => { const [a, fs] = t.split(':'); return [a, fs.split(',').map(Number)]; });
  await save(opt('name', `${c}-batch`), 'sheetMulti', c, pal, spec, scale === 4 ? 3 : scale, +opt('cols', 8));
} else if (flag('heads')) {
  for (const c of (pos.length ? pos : chars)) for (const p of [0, 1]) await save(`${c}-heads-p${p}`, 'sheetHeads', c, p, +opt('scale', 10));
} else if (flag('palettes')) {
  for (const c of chars) await save(`${c}-palettes`, 'sheetPalettes', c, ['idle', 'walkF', '5H', 'hitHigh', 'win'], 4);
} else if (flag('versus')) {
  await save('versus', 'sheetVersus', pos[0] || 'idle', pos[1] || 'idle', 3);
} else {
  const [c, anim, n] = pos;
  const name = `${c}-${anim}${pal ? '-p' + pal : ''}${flag('mirror') ? '-m' : ''}`;
  await save(name, 'sheetAnim', c, anim, pal, n == null ? 8 : +n, scale, { anchors: flag('anchors'), facing: flag('mirror') ? -1 : 1, cols: opt('cols') ? +opt('cols') : undefined, walk: flag('walk') });
}

if (errors.length) { console.log('CONSOLE:'); errors.slice(0, 20).forEach((e) => console.log('  ' + e)); }
await browser.close();
