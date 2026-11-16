#!/usr/bin/env node
/* LATENT CLASH — FIGHT combo verifier: plays each documented bread-and-butter combo with
 * scripted, human-timed inputs in training mode and checks hit count + damage.
 *   node tools/fight-combos.mjs [--real] [--spread]                                     */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const real = process.argv.includes('--real');

// steps: 'j9' jump forward · 'jH' jump attack when low · '5L'/'2M'… normal (cancelled on hit) ·
// '214H' etc. motion special · 'S' rekka follow-up · 'SUPER' (H+S) · 'wN' wait N frames
export const COMBOS = {
  claude: [
    { name: 'jH > 5L > 5M > 5H > 214H (haiku)', dist: 130, steps: ['j9', 'jH', '5L', '5M', '5H', '214H'], hits: 7 },
    { name: '2L > 2M > 2H (sweep)', dist: 50, steps: ['2L', '2M', '2H'], hits: 3 },
    { name: '5M > 5H > 236H (spark)', dist: 62, steps: ['5M', '5H', '236H'], hits: 3 },
    { name: 'jH > 5M > 5H > 214H > SUPER', dist: 130, steps: ['j9', 'jH', '5M', '5H', '214H', 'SUPER'], hits: 13, meter: true }
  ],
  deepseek: [
    { name: 'jH > 5L > 5M > 5H > 214H > S > S (rekka)', dist: 140, steps: ['j9', 'jH', '5L', '5M', '5H', '214H', 'S', 'S'], hits: 7 },
    { name: '2L > 2M > 5H > 236H (wave)', dist: 34, steps: ['2L', '2M', '5H', '236H'], hits: 4 },
    { name: '5L > 5M > 623H (breach)', dist: 40, steps: ['5L', '5M', '623H'], hits: 3 },
    { name: 'jH > 5L > 5H > 214H > S > S > SUPER', dist: 140, steps: ['j9', 'jH', '5L', '5H', '214H', 'S', 'S', 'SUPER'], hits: 11, meter: true }
  ],
  gpt: [
    { name: 'jH > 5L > 5M > 5H > 236H (breath)', dist: 120, steps: ['j9', 'jH', '5L', '5M', '5H', '236H'], hits: 7 },
    { name: '2L > 2M > 2H (tail sweep)', dist: 44, steps: ['2L', '2M', '2H'], hits: 3 },
    { name: '5L > 5M > 623H (dragonRise)', dist: 36, steps: ['5L', '5M', '623H'], hits: 3 },
    { name: 'jH > 5M > 623H (dragonRise)', dist: 110, steps: ['j9', 'jH', '5M', '623H'], hits: 3 },
    { name: '5M > 5H > 236H (3 hits) > SUPER', dist: 52, steps: ['5M', '5H', '236H', 'w34', 'SUPER'], hits: 10, meter: true }
  ]
};
// --vs=claude|deepseek|gpt : dummy character (default: the next one in the roster)
const VS = (process.argv.find(a => a.startsWith('--vs=')) || '').slice(5) || null;
const ONLY = (process.argv.find(a => a.startsWith('--chars=')) || '').slice(8) || null;

function inPage() {
  window.COMBO = function (ch, c, vs) {
    const F = LC.fight;
    F.headless = true;
    const R = ['claude', 'deepseek', 'gpt'];
    const other = vs || R[(R.indexOf(ch) + 1) % R.length];
    const m = F.createMatch({ mode: 'training', stage: 'training', seed: 5, p1: { char: ch }, p2: { char: other, control: 'human' },
      training: { dummy: 'stand', guard: 'none', meter: c.meter ? 'full' : 'normal', refill: false } });
    const A = m.f[0], B = m.f[1];
    B.x = A.x + c.dist; m.update({}, {});
    const MOT = { '236': [2, 3, 6], '623': [6, 2, 3], '214': [2, 1, 4], '22': [2, 5, 2] };
    const DIR = { 1: { down: 1, left: 1 }, 2: { down: 1 }, 3: { down: 1, right: 1 }, 4: { left: 1 }, 5: {}, 6: { right: 1 }, 9: { up: 1, right: 1 } };
    const q = []; let maxCombo = 0, t = 0, log = [];
    const hp0 = B.hp;
    function queue(seq) { for (const s of seq) q.push(s); }
    let si = 0, acted = -1, waitHit = false;
    while (t < 600) {
      let inp = {};
      if (q.length) { const s = q.shift(); inp = Object.assign({}, DIR[s.d || 5]); for (const b of (s.b || '')) inp[b] = 1; }
      else if (si < c.steps.length) {
        const st = c.steps[si];
        const ready = (!waitHit || (A.connected === 'hit' && A.moveInst !== acted) || (acted === -2 && !A.air)) && !(A.air && /^[25]/.test(st));
        if (st === 'j9') { queue([{ d: 9 }, { d: 9 }, { d: 9 }]); si++; }
        else if (/^w\d+$/.test(st)) { if (ready) { for (let k = +st.slice(1); k > 0; k--) q.push({}); si++; } }
        else if (st === 'jH') { if (A.air && A.vy > 0 && (LC.GROUND_Y - A.y) < (c.jh || 76)) { queue([{ b: 'H' }, { b: 'H' }]); si++; waitHit = true; acted = -2; } }
        else if (ready) {
          acted = A.moveInst;
          if (st === 'SUPER') queue([{ b: 'HS' }, { b: 'HS' }]);
          else if (st === 'S') queue([{ b: '' }, { b: 'M' }, { b: 'M' }]);
          else if (/^\d{3}/.test(st)) { const mm = MOT[st.slice(0, 3)]; mm.forEach((d, i) => { q.push({ d, b: i === mm.length - 1 ? st[3] : '' }); q.push({ d, b: i === mm.length - 1 ? st[3] : '' }); }); }
          else { const d = +st[0]; queue([{ d, b: st[1] }, { d, b: st[1] }, { d }]); }
          si++; waitHit = true;
        }
      }
      m.update(inp, {});
      t++;
      if (window.CDBG && A.mv && A.mv.id !== log.lastMv) { log.lastMv = A.mv.id; log.push('START ' + A.mv.id + ' t' + t + ' conn ' + A.connected + ' B ' + B.action); }
      if (window.CDBG && A.mv && A.mv.kind === 'super' && A.sf % 6 === 0) log.push(A.seg().id + A.sf + ' B ' + B.action + ' y' + (LC.GROUND_Y - B.y).toFixed(0) + ' dx' + (B.x - A.x).toFixed(0) + ' c' + A.combo + ' j' + B.juggle);
      if (A.combo > maxCombo) maxCombo = A.combo;
      if (A.combo === 0 && maxCombo > 0 && B.action !== 'hitstun' && B.action !== 'launch' && t > 30 && si >= c.steps.length && !q.length && A.action !== 'attack') break;
    }
    return { hits: maxCombo, dmg: hp0 - B.hp, log: window.CDBG ? log.join('\n') : '' };
  };
}

// Oki-loop check: GPT command grab -> hard knock-down -> meaty command grab timed at every offset k around
// the victim's first throwable frame. Each escape option must beat every timing; 'none' / 'block' must be
// grabbable at some timing (the mix-up is real, not an unblockable loop).
function okiPage() {
  window.OKI = function (vs, opt, k) {
    const F = LC.fight, T = F.T;
    F.headless = true;
    const m = F.createMatch({ mode: 'versus', stage: 'training', seed: 9, intro: false, rounds: 3, p1: { char: 'gpt' }, p2: { char: vs, control: 'human' } });
    let t = 0;
    while (m.state !== 'fight' && t++ < 2000) m.update({}, {});
    const A = m.f[0], B = m.f[1];
    B.x = A.x + 50; m.update({}, {});
    const mot = (o) => [{ down: 1 }, { down: 1 }, { down: 1, left: 1 }, { down: 1, left: 1 }, Object.assign({ left: 1 }, o), Object.assign({ left: 1 }, o)];
    const q1 = mot({ M: 1 });
    let g0 = -1, grabs = 0, lastInst = -1, n = 0;
    for (t = 0; t < 400; t++) {
      if (B.action === 'getup' && g0 < 0) g0 = t;
      let i1 = q1.length ? q1.shift() : {}, i2 = {};
      if (g0 >= 0) {
        const press = g0 + T.GETUP + T.WAKE_THROW_INV + k - 7;   // call M active frames 8..10 after the press
        const d = t - (press - 4);
        if (d >= 0 && d < 6) i1 = mot({ M: 1 })[d];
        const w = t - g0;   // victim's wake-up input, relative to the get-up start (bk / fw = screen dirs)
        const bk = B.facing > 0 ? 'left' : 'right', fw = B.facing > 0 ? 'right' : 'left', o = (x) => Object.assign({}, x);
        if (opt === 'backdash') i2 = (w >= 20 && w <= 21) || (w >= 25 && w <= 26) ? o({ [bk]: 1 }) : {};
        else if (opt === 'jump') i2 = w >= 18 && w <= 34 ? { up: 1 } : {};
        else if (opt === 'reversal') i2 = [o({ [fw]: 1 }), o({ [fw]: 1 }), { down: 1 }, { down: 1 }, o({ down: 1, [fw]: 1 }), o({ down: 1, [fw]: 1, H: 1 }), { H: 1 }][w - 17] || {};
        else if (opt === 'block') i2 = w >= 10 ? o({ [bk]: 1 }) : {};
      }
      m.update(i1, i2);
      if (A.mv && A.mv.id === 'callHit' && A.moveInst !== lastInst) { lastInst = A.moveInst; grabs++; }
      if (g0 >= 0 && t > g0 + 70) break;
    }
    return { grabs, g0 };
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + root + '/dev/fight-sandbox.html?manual=1' + (real ? '' : '&stubs=all'));
await page.waitForFunction(() => window.FS && FS.ready);
await page.evaluate(inPage);
if (process.argv.includes('--debug')) await page.evaluate(() => { window.CDBG = 1; });
let fail = 0;
const spread = process.argv.includes('--spread');   // also report which start distances (dist-16..+16) still work
const ALLVS = process.argv.includes('--all');   // every combo against every other character
for (const ch in COMBOS) for (const c of COMBOS[ch]) {
  if (ONLY && ONLY.split(',').indexOf(ch) < 0) continue;
  const targets = ALLVS ? ['claude', 'deepseek', 'gpt'].filter(x => x !== ch) : [VS && VS !== ch ? VS : null];
  for (const vs of targets) {
    if (spread) {
      let line = '';
      for (const d of [-16, -8, 0, 8, 16, 24]) { const r2 = await page.evaluate(([ch, c, vs]) => window.COMBO(ch, c, vs), [ch, Object.assign({}, c, { dist: c.dist + d }), vs]); line += (d >= 0 ? '+' : '') + d + (r2.hits >= c.hits ? ':ok ' : ':' + r2.hits + ' '); }
      console.log('     spread ' + ch + ' ' + c.name.padEnd(44) + line);
    }
    const r = await page.evaluate(([ch, c, vs]) => window.COMBO(ch, c, vs), [ch, c, vs]);
    const ok = r.hits >= c.hits;
    if (!ok) fail++;
    if (r.log && !ok) console.log(r.log);
    console.log((ok ? 'OK  ' : 'FAIL') + ' ' + ch.padEnd(8) + ' ' + c.name.padEnd(44) + (vs ? ' vs ' + vs.padEnd(8) : '') + ' hits ' + r.hits + '/' + c.hits + '  dmg ' + r.dmg);
  }
}
if (!process.argv.includes('--no-oki')) {
  await page.evaluate(okiPage);
  for (const vs of ['claude', 'deepseek']) for (const opt of ['none', 'block', 'backdash', 'jump', 'reversal']) {
    const res = [];
    for (let k = -6; k <= 14; k += 2) res.push((await page.evaluate(([vs, o, k]) => window.OKI(vs, o, k), [vs, opt, k])).grabs);
    const caught = res.filter(g => g >= 2).length, first = res.every(g => g >= 1);
    const escape = opt === 'backdash' || opt === 'jump' || opt === 'reversal';
    const ok = first && (escape ? caught === 0 : caught > 0);
    if (!ok) fail++;
    console.log((ok ? 'OK  ' : 'FAIL') + ' oki gpt call -> meaty call vs ' + vs.padEnd(8) + ' wake-up ' + opt.padEnd(9) + ' re-grabbed at ' + caught + '/' + res.length + ' timings (k = -6..14)');
  }
}
await browser.close();
process.exit(fail ? 1 : 0);
