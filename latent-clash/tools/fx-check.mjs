#!/usr/bin/env node
/* LATENT CLASH — FX smoke check (owned by FX): every spawn effect x char (none/claude/deepseek/gpt/gemini)
 * x palette x facing x settings.flash, every sprite x phase x t; prints call count, names, the gpt
 * sprite infos, and console errors/warnings (expect 0).   node tools/fx-check.mjs */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const b = await chromium.launch(); const page = await b.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(pathToFileURL(resolve(root, 'dev/fx-viewer.html')).href + '?headless=1');
await page.waitForFunction(() => window.FXV && window.FXV.ready, null, { timeout: 20000 });
const r = await page.evaluate(() => {
  const FX = window.LC.fx, n = FX.names(), gc = document.createElement('canvas'); gc.width = 384; gc.height = 216;
  const g = gc.getContext('2d'); let calls = 0;
  for (const flash of [true, false]) {
    window.LC.settings.flash = flash;
    for (const ch of [null, 'claude', 'deepseek', 'gpt', 'gemini']) for (const pal of [0, 1]) for (const fc of [1, -1]) {
      for (const e of n.spawn) {
        FX.clear(); FX.spawn(e, 180, 150, { char: ch, palette: pal, facing: fc, power: pal ? 0.3 : 1, index: pal + 1 });
        for (let t = 0; t < 30; t++) { FX.draw(g, 0, 'back'); FX.draw(g, 0, 'front'); FX.update(); calls++; }
      }
      for (const s of n.sprites) for (const ph of [undefined, 'start', 'loop', 'end', 'out', 'fire', 'counter']) for (const t of [0, 3, 8, 13, 20, 30, 45, 50, 57, 60, 69, 80]) {
        const full = s.startsWith('screen.') || s === 'gpt.attention' || s === 'gemini.meteor';
        FX.drawSprite(g, s, full ? 0 : 180, 150, t, { char: ch, palette: pal, facing: fc, phase: ph, tx: 300, ty: 120, ax: fc > 0 ? 70 : 314, ay: 112, bx: fc > 0 ? 314 : 70, by: 112, length: 85, angle: 45, part: t & 1 ? 'back' : undefined });
        calls++;
      }
    }
  }
  window.LC.settings.flash = true; FX.clear();
  const i = FX.spriteInfo('gpt.attention'), br = FX.spriteInfo('gpt.breath'), gm = FX.spriteInfo('gemini.meteor'), gs = FX.spriteInfo('gemini.star');
  return { calls, names: n.spawn.length + ' spawn / ' + n.sprites.length + ' sprites',
    gpt: n.spawn.filter((x) => x.startsWith('gpt')).concat(n.sprites.filter((x) => x.startsWith('gpt'))),
    attention: { duration: i.duration, events: i.events, f10: i.frames[10], f30: i.frames[30], f46: i.frames[46] },
    breathBox: { L110a0: br.box(110, 0), M85a0: br.box(85, 0), L60a45: br.box(60, 45) },
    gemini: n.spawn.filter((x) => x.startsWith('gemini')).concat(n.sprites.filter((x) => x.startsWith('gemini'))),
    meteor: { duration: gm.duration, events: gm.events, f10: gm.frames[10], f22: gm.frames[22], f50: gm.frames[50], f57: gm.frames[57], nFrames: gm.frames.length },
    star: gs.boxes };
});
console.log(JSON.stringify(r, null, 1));
console.log('console errors/warnings:', errs.length ? '\n' + errs.join('\n') : 0);
await b.close();
