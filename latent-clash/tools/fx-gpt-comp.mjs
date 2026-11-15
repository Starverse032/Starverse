#!/usr/bin/env node
/* LATENT CLASH — FX: full super composition strip for review (owned by FX).
 *   node tools/fx-gpt-comp.mjs [--char=gpt] [--frames=0,8,16,...] [--tx=260] [--ty=140] [--facing=1]
 *        [--palette=0] [--scale=2] [--cols=4] [--tag=t] [--flash=0]
 * Draws: superBackdrop (stage-like mock under the intro) -> gpt.attention back -> two fighter
 * dummies -> gpt.attention front, exactly like the FIGHT layering. Output .shots/fx/_comp-<char>[-tag].png */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const o = {
  ch: flag('char', 'gpt'), frames: String(flag('frames', '0,6,12,16,22,26,34,44,46,48,52,60')).split(',').map(Number),
  tx: +flag('tx', 262), ty: +flag('ty', 140), facing: +flag('facing', 1), palette: +flag('palette', 0),
  scale: +flag('scale', 2), cols: +flag('cols', 4), flash: flag('flash', '1') !== '0'
};
const tag = flag('tag') ? '-' + flag('tag') : '';
mkdirSync(resolve(root, '.shots/fx'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(resolve(root, 'dev/fx-viewer.html')).href + '?headless=1');
await page.waitForFunction(() => window.FXV && window.FXV.ready, null, { timeout: 20000 });
const url = await page.evaluate((o) => {
  const FX = window.LC.fx, W = 384, H = 216, GY = 186, S = o.scale;
  window.LC.settings.flash = o.flash;
  const gc = document.createElement('canvas'); gc.width = W; gc.height = H;
  const g = gc.getContext('2d'); g.imageSmoothingEnabled = false;
  const rows = Math.ceil(o.frames.length / o.cols);
  const out = document.createElement('canvas'); out.width = o.cols * (W * S + 4); out.height = rows * (H * S + 4);
  const og = out.getContext('2d'); og.imageSmoothingEnabled = false; og.fillStyle = '#111'; og.fillRect(0, 0, out.width, out.height);
  const fx = o.facing, me = o.tx - fx * 90;
  function dummy(x, body, line) {
    g.fillStyle = line; g.fillRect(x - 9, GY - 103, 18, 20); g.fillRect(x - 13, GY - 84, 26, 44); g.fillRect(x - 11, GY - 41, 9, 41); g.fillRect(x + 2, GY - 41, 9, 41);
    g.fillStyle = body; g.fillRect(x - 8, GY - 102, 16, 18); g.fillRect(x - 12, GY - 83, 24, 42); g.fillRect(x - 10, GY - 41, 7, 40); g.fillRect(x + 3, GY - 41, 7, 40);
  }
  o.frames.forEach((t, i) => {
    g.fillStyle = '#3a3448'; g.fillRect(0, 0, W, H);
    FX.drawSprite(g, 'screen.superBackdrop', 0, 0, t, { char: o.ch, facing: fx, palette: o.palette });
    if (o.ch === 'gpt') FX.drawSprite(g, 'gpt.attention', 0, 0, t, { tx: o.tx, ty: o.ty, facing: fx, palette: o.palette, part: 'back' });
    dummy(me, '#f1f0f8', '#2a2540'); dummy(o.tx, '#c9a37a', '#2a1714');
    if (o.ch === 'gpt') FX.drawSprite(g, 'gpt.attention', 0, 0, t, { tx: o.tx, ty: o.ty, facing: fx, palette: o.palette, part: 'front' });
    const cx = (i % o.cols) * (W * S + 4), cy = Math.floor(i / o.cols) * (H * S + 4);
    og.drawImage(gc, 0, 0, W, H, cx, cy, W * S, H * S);
    og.fillStyle = '#fff'; og.fillRect(cx, cy, 14, 8); og.fillStyle = '#000'; og.font = '8px monospace'; og.fillText(String(t), cx + 1, cy + 7);
  });
  return out.toDataURL('image/png');
}, o);
const file = resolve(root, '.shots/fx/_comp-' + o.ch + tag + '.png');
writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote', file.replace(root + '/', ''));
if (errors.length) console.log('errors:\n' + errors.join('\n'));
await browser.close();
