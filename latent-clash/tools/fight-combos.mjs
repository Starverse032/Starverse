#!/usr/bin/env node
/* LATENT CLASH — FIGHT combo verifier: plays each documented bread-and-butter combo with
 * scripted, human-timed inputs in training mode and checks hit count + damage.
 *   node tools/fight-combos.mjs [--real]                                            */
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
    { name: 'jH > 5L > 5M > 5H > 214H (haiku)', dist: 104, steps: ['j9', 'jH', '5L', '5M', '5H', '214H'], hits: 7 },
    { name: '2L > 2M > 2H (sweep)', dist: 40, steps: ['2L', '2M', '2H'], hits: 3 },
    { name: '5M > 5H > 236H (spark)', dist: 50, steps: ['5M', '5H', '236H'], hits: 3 },
    { name: 'jH > 5M > 5H > 214H > SUPER', dist: 104, steps: ['j9', 'jH', '5M', '5H', '214H', 'SUPER'], hits: 13, meter: true }
  ],
  deepseek: [
    { name: 'jH > 5L > 5M > 5H > 214H > S > S (rekka)', dist: 112, steps: ['j9', 'jH', '5L', '5M', '5H', '214H', 'S', 'S'], hits: 7 },
    { name: '2L > 2M > 5H > 236H (wave)', dist: 26, steps: ['2L', '2M', '5H', '236H'], hits: 4 },
    { name: '5L > 5M > 623H (breach)', dist: 30, steps: ['5L', '5M', '623H'], hits: 3 },
    { name: 'jH > 5L > 5H > 214H > S > S > SUPER', dist: 112, steps: ['j9', 'jH', '5L', '5H', '214H', 'S', 'S', 'SUPER'], hits: 11, meter: true }
  ]
};

function inPage() {
  window.COMBO = function (ch, c) {
    const F = LC.fight;
    F.headless = true;
    const other = ch === 'claude' ? 'deepseek' : 'claude';
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
        else if (st === 'jH') { if (A.air && A.vy > 0 && (LC.GROUND_Y - A.y) < 58) { queue([{ b: 'H' }, { b: 'H' }]); si++; waitHit = true; acted = -2; } }
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

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + root + '/dev/fight-sandbox.html?manual=1' + (real ? '' : '&stubs=all'));
await page.waitForFunction(() => window.FS && FS.ready);
await page.evaluate(inPage);
if (process.argv.includes('--debug')) await page.evaluate(() => { window.CDBG = 1; });
let fail = 0;
for (const ch in COMBOS) for (const c of COMBOS[ch]) {
  const r = await page.evaluate(([ch, c]) => window.COMBO(ch, c), [ch, c]);
  const ok = r.hits >= c.hits;
  if (!ok) fail++;
  if (r.log && !ok) console.log(r.log);
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + ch.padEnd(8) + ' ' + c.name.padEnd(44) + ' hits ' + r.hits + '/' + c.hits + '  dmg ' + r.dmg);
}
await browser.close();
process.exit(fail ? 1 : 0);
