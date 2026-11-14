#!/usr/bin/env node
/* LATENT CLASH — FIGHT scripted screenshots → .shots/fight/*.png (×3 nearest-neighbour).
 *   node tools/fight-shots.mjs [--real] [--only=name1,name2] [--boxes]
 * Scenarios: every normal / special per character (training, hitboxes optional), a combo,
 * super flash + active, KO, intro dialogue, match-end quote, HUD in a CPU match. */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const out = path.join(root, '.shots/fight');
fs.mkdirSync(out, { recursive: true });

// input helpers (P1 faces right at round start)
const D = { 1: { down: 1, left: 1 }, 2: { down: 1 }, 3: { down: 1, right: 1 }, 4: { left: 1 }, 5: {}, 6: { right: 1 }, 7: { up: 1, left: 1 }, 8: { up: 1 }, 9: { up: 1, right: 1 } };
const st = (n, d, b) => [n, Object.assign({}, D[d || 5], b ? Object.fromEntries(b.split('').map(c => [c, 1])) : {})];
const mot = (seq, b) => seq.split('').map((d, i, a) => st(2, +d, i === a.length - 1 ? b : ''));
const press = (b, d, wait) => [st(2, d || 5, b), st(wait || 1, d || 5)];
const W = n => [st(n, 5)];
const near = [st(40, 6)];                       // walk in until close

const T = (p1, p2, extra) => Object.assign({ mode: 'training', stage: 'training', seed: 7, p1: { char: p1 }, p2: { char: p2, control: 'human' }, training: { dummy: 'stand', guard: 'none', hitboxes: !!args.boxes } }, extra || {});
const S = [];
function add(name, cfg, steps, after) { S.push({ name, cfg, steps, after: after || 0 }); }

for (const [c, o] of [['claude', 'deepseek'], ['deepseek', 'claude']]) {
  for (const n of ['5L', '5M', '5H', '2L', '2M', '2H']) {
    const d = n[0] === '2' ? 2 : 5, startup = { claude: { '5L': 5, '5M': 8, '5H': 12, '2L': 5, '2M': 8, '2H': 11 }, deepseek: { '5L': 4, '5M': 7, '5H': 10, '2L': 4, '2M': 7, '2H': 10 } }[c][n];
    add(`${c}-${n}`, T(c, o), [...near, st(1, d, n[1]), st(startup, d)]);
  }
  add(`${c}-jH`, T(c, o), [st(14, 6), st(3, 9), st(16, 5), st(12, 5, 'H')]);
  add(`${c}-throw`, T(c, o), [...near, st(1, 5, 'LM'), st(28, 5)]);
}
add('claude-spark', T('claude', 'deepseek'), [...mot('236', 'H'), ...W(30)]);
add('claude-sonnet', T('claude', 'deepseek'), [...near, ...mot('623', 'H'), ...W(10)]);
add('claude-haiku', T('claude', 'deepseek'), [...near, ...mot('214', 'M'), ...W(20)]);
add('claude-guardrail', T('claude', 'deepseek'), [...mot('252', 'M'), ...W(8)]);
add('deepseek-wave', T('deepseek', 'claude'), [...mot('236', 'H'), ...W(34)]);
add('deepseek-breach', T('deepseek', 'claude'), [...near, ...mot('623', 'H'), ...W(10)]);
add('deepseek-chain', T('deepseek', 'claude'), [...near, ...mot('214', 'M'), ...W(14), st(2, 5, 'M'), st(12, 5), st(2, 5, 'M'), st(12, 5)]);
add('deepseek-dive', T('deepseek', 'claude'), [...mot('252', 'H'), ...W(30)]);
add('deepseek-divekick', T('deepseek', 'claude'), [st(3, 9), st(18, 5), ...mot('236', 'M'), ...W(6)]);
add('claude-combo', T('claude', 'deepseek'), [st(12, 6), st(3, 9), st(22, 5), st(2, 5, 'H'), st(14, 5), st(2, 5, 'L'), st(8, 5), st(2, 5, 'M'), st(12, 5), st(2, 5, 'H'), st(12, 5), ...mot('214', 'H'), ...W(30)]);
add('deepseek-combo', T('deepseek', 'claude'), [st(10, 6), st(3, 9), st(22, 5), st(2, 5, 'H'), st(12, 5), st(2, 5, 'L'), st(7, 5), st(2, 5, 'M'), st(10, 5), st(2, 5, 'H'), st(10, 5), ...mot('214', 'H'), st(14, 5), st(2, 5, 'M'), st(12, 5), st(2, 5, 'M'), st(14, 5)]);
const meter = { training: { dummy: 'stand', guard: 'none', meter: 'full', hitboxes: false } };
add('claude-superflash', T('claude', 'deepseek', meter), [...near, st(2, 5, 'HS'), ...W(18)]);
add('claude-superbeam', T('claude', 'deepseek', meter), [...near, st(2, 5, 'HS'), ...W(80)]);
add('deepseek-superflash', T('deepseek', 'claude', meter), [...near, st(2, 5, 'HS'), ...W(18)]);
add('deepseek-superwhale', T('deepseek', 'claude', meter), [...near, st(2, 5, 'HS'), ...W(74)]);
add('intro', { mode: 'versus', stage: 'library', seed: 3, intro: true, p1: { char: 'claude' }, p2: { char: 'deepseek', control: 'cpu', level: 3 } }, [...W(150)]);
add('ready', { mode: 'versus', stage: 'library', seed: 3, intro: false, p1: { char: 'claude' }, p2: { char: 'deepseek', control: 'cpu', level: 3 } }, [...W(30)]);
add('hud', { mode: 'demo', stage: 'abyss', seed: 11, intro: false, p1: { char: 'claude', control: 'cpu', level: 5 }, p2: { char: 'deepseek', control: 'cpu', level: 5 } }, [...W(1500)]);
add('ko', { mode: 'demo', stage: 'library', seed: 21, intro: false, p1: { char: 'claude', control: 'cpu', level: 5 }, p2: { char: 'deepseek', control: 'cpu', level: 4 } }, [], 'ko');
add('matchend', { mode: 'demo', stage: 'library', seed: 21, intro: false, p1: { char: 'claude', control: 'cpu', level: 5 }, p2: { char: 'deepseek', control: 'cpu', level: 4 } }, [], 'quote');

const only = args.only ? String(args.only).split(',') : null;
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror ' + e.message));
await page.goto('file://' + root + '/dev/fight-sandbox.html?manual=1' + (args.real ? '' : '&stubs=all'));
await page.waitForFunction(() => window.FS && FS.ready, null, { timeout: 20000 });
let n = 0;
for (const s of S) {
  if (only && !only.some(o => s.name.includes(o))) continue;
  const data = await page.evaluate(([s]) => {
    const m = FS.newMatch(s.cfg);
    for (const [k, inp] of s.steps) for (let i = 0; i < k; i++) m.update(inp, {});
    if (s.after === 'ko') { let t = 0; while (m.state !== 'ko' && t++ < 20000) m.update({}, {}); for (let i = 0; i < 50; i++) m.update({}, {}); }
    if (s.after === 'quote') { let t = 0; while (m.state !== 'matchEnd' && t++ < 60000) m.update({}, {}); for (let i = 0; i < 140; i++) m.update({}, {}); }
    m.draw(FS.ctx);
    const c = document.createElement('canvas'); c.width = 1152; c.height = 648;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(FS.canvas, 0, 0, 1152, 648);
    return c.toDataURL('image/png');
  }, [s]);
  fs.writeFileSync(path.join(out, s.name + '.png'), Buffer.from(data.split(',')[1], 'base64'));
  n++;
}
console.log('wrote', n, 'shots to', out, '| console errors:', errs.length, errs.slice(0, 3).join(' / '));
await browser.close();
