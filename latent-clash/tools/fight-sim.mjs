#!/usr/bin/env node
/* LATENT CLASH — FIGHT headless simulator.
 * Runs many CPU-vs-CPU matches at unlimited speed (no drawing) in headless Chromium, asserts
 * invariants every tick, checks determinism, and prints a balance table.
 *
 *   node tools/fight-sim.mjs [--n=12] [--levels=1,3,5] [--real] [--seed=1] [--draw] [--pairs=claude-gpt,deepseek-gpt] [--mirror]
 *     --n       matches per (character pair, level, side) (each pairing runs both side assignments)
 *     --pairs   character pairs (default: every cross pairing of the roster); --mirror adds a-vs-a
 *     --levels  equal-level pairings to test
 *     --cross   also run level a vs level b pairings (1v3, 3v5, 5v1 ...)
 *     --real    use real modules where present (default: stubs=all, pure gameplay)
 *     --draw    also call draw() every 30 ticks (catches render exceptions; slower)
 */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const b = a.replace(/^--/, ''), i = b.indexOf('='); return i < 0 ? [b, true] : [b.slice(0, i), b.slice(i + 1)]; }));
const N = +(args.n || 12);
const LEVELS = String(args.levels || '1,3,5').split(',').map(Number);
const SEED = +(args.seed || 1);
const ROSTER = String(args.chars || 'claude,deepseek,gpt').split(',');
let PAIRS = [];
if (args.pairs) PAIRS = String(args.pairs).split(',').map(p => p.split('-'));
else for (let i = 0; i < ROSTER.length; i++) for (let j = i + 1; j < ROSTER.length; j++) PAIRS.push([ROSTER[i], ROSTER[j]]);
if (args.mirror) for (const c of ROSTER) PAIRS.push([c, c]);
const url = 'file://' + root + '/dev/fight-sandbox.html?manual=1' + (args.real ? '' : '&stubs=all');

function pageRunner() {
  // executed in the page
  window.SIM = function (cfg, opts) {
    const F = LC.fight, T = F.T;
    F.headless = !opts.draw;
    F.AI_OFF = opts.off || null;
    if (opts.mu && F.AI_PROF) for (const k in opts.mu) { const [c, v] = k.split('>'); const P = F.AI_PROF[c]; if (P) { P.vs = P.vs || {}; P.vs[v] = opts.mu[k]; } }   // --mu=gpt>deepseek:breath=1.5;tail=2
    const m = F.createMatch(cfg);
    const viol = [];
    const usage = [{}, {}], plans = [{}, {}];
    m.aiHook = function (f, mv) { usage[f.side][mv.id] = (usage[f.side][mv.id] || 0) + 1; };
    if (opts.plans) for (let s = 0; s < 2; s++) if (m.ai[s]) { const ai = m.ai[s], pu = ai.push; ai.push = function (st, name) { if (name) plans[s][name] = (plans[s][name] || 0) + 1; return pu.call(this, st, name); }; }
    const dmgBy = [{}, {}], oc = m.onContact;
    m.onContact = function (att, vic, what, dmg, h, kind, counter) {
      if (what === 'hit') { const k = kind === 'throw' ? 'throw' : (h && h.fx && /sparkHit|waveHit/.test(h.fx)) ? 'proj' : (att.mv ? att.mv.id : kind); dmgBy[att.side][k] = (dmgBy[att.side][k] || 0) + dmg; }
      if (what === 'grab' || what === 'erase') dmgBy[att.side]['_' + what] = (dmgBy[att.side]['_' + what] || 0) + 1;
      if (counter) dmgBy[att.side]._counters = (dmgBy[att.side]._counters || 0) + 1;
      return oc.apply(this, arguments);
    };
    let lastHp = [m.f[0].hp, m.f[1].hp], round = m.round, stateT = 0, lastState = m.state;
    const roundLen = []; let fightT = 0;
    const stuck = [{ k: '', t: 0 }, { k: '', t: 0 }];
    const ctx = opts.draw ? FS.ctx : null;
    let t = 0;
    const CAP = 60000;
    function bad(msg) { if (viol.length < 12) viol.push('t' + t + ' r' + m.round + ' ' + msg); }
    while (!m.finished && t < CAP) {
      m.update({}, {});
      t++;
      if (ctx && t % 30 === 0) m.draw(ctx);
      if (m.state !== lastState) { lastState = m.state; stateT = 0; } else stateT++;
      if (m.state === 'fight') fightT++;
      if (m.round !== round) { roundLen.push(fightT); fightT = 0; round = m.round; lastHp = [m.f[0].hp, m.f[1].hp]; }
      const lim = m.state === 'fight' ? (cfg.time > 0 ? cfg.time * 60 + 600 : 1e9) : 1500;
      if (stateT > lim) { bad('state ' + m.state + ' stuck ' + stateT); break; }
      for (let i = 0; i < 2; i++) {
        const f = m.f[i];
        for (const k of ['x', 'y', 'vx', 'vy', 'hp', 'meter']) if (!Number.isFinite(f[k])) bad('NaN ' + k + ' p' + i);
        if (f.x < T.WALL - 0.01 || f.x > LC.STAGE_W - T.WALL + 0.01) bad('x out ' + f.x.toFixed(1) + ' p' + i + ' ' + f.action);
        if (f.y > LC.GROUND_Y + 0.01 || f.y < -150) bad('y out ' + f.y.toFixed(1) + ' p' + i);
        if (m.state !== 'roundEnd' && f.hp > lastHp[i] && m.round === round) bad('hp rose p' + i);
        lastHp[i] = f.hp;
        if (f.meter < 0 || f.meter > 100) bad('meter ' + f.meter);
        const key = f.action + '|' + (f.mv ? f.mv.id + f.moveInst : '');
        if (key === stuck[i].k) { stuck[i].t++; const ok = F.NEUTRAL_OK[f.action] === 1; if (!ok && stuck[i].t === 400 && m.state === 'fight') bad('stuck p' + i + ' ' + key); }
        else { stuck[i].k = key; stuck[i].t = 0; }
      }
      if (Math.abs(m.f[0].x - m.f[1].x) > T.MAXSEP + 0.5 && m.f[0].action !== 'thrown' && m.f[1].action !== 'thrown') bad('separation ' + Math.abs(m.f[0].x - m.f[1].x).toFixed(1));
      for (const p of m.projs) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad('proj NaN');
    }
    if (!m.finished) bad('did not finish in ' + t);
    if (fightT) roundLen.push(fightT);
    const snap = JSON.stringify(m.snapshot());
    return { t, finished: m.finished, result: m.result, viol, usage, plans, dmgBy, roundLen, snap, errs: FS.errors.slice(0, 5) };
  };
}

async function main() {
  const browser = await chromium.launch();
  const W = 4;
  const pages = [];
  const consoleErrs = [];
  for (let i = 0; i < W; i++) {
    const p = await browser.newPage();
    p.on('console', msg => { if (msg.type() === 'error') consoleErrs.push(msg.text() + ' @ ' + JSON.stringify(msg.location())); });
    p.on('pageerror', e => consoleErrs.push('pageerror ' + e.stack));
    p.on('pageerror', e => consoleErrs.push('pageerror ' + e.message));
    await p.goto(url);
    await p.waitForFunction(() => window.FS && FS.ready, null, { timeout: 20000 });
    await p.evaluate(pageRunner);
    pages.push(p);
  }
  const jobs = [];
  const pairs = LEVELS.map(l => [l, l]);
  if (args.cross) for (let i = 0; i < LEVELS.length; i++) for (let j = 0; j < LEVELS.length; j++) if (i !== j) pairs.push([LEVELS[i], LEVELS[j]]);
  let seed = SEED * 1000;
  for (const [ca, cb] of PAIRS) for (const [la, lb] of pairs) for (let k = 0; k < N; k++) for (const swap of [false, true]) {
    const A = { char: ca, control: 'cpu', level: la }, B = { char: cb, palette: ca === cb ? 1 : 0, control: 'cpu', level: lb };
    jobs.push({ ca, cb, la, lb, swap, cfg: { mode: 'demo', stage: 'training', seed: seed++, rounds: 2, time: 99, intro: false, p1: swap ? B : A, p2: swap ? A : B } });
  }
  // determinism check jobs
  const det = [{ mode: 'demo', stage: 'training', seed: 4242, rounds: 2, time: 99, intro: true, p1: { char: 'claude', control: 'cpu', level: 4 }, p2: { char: 'deepseek', control: 'cpu', level: 4 } },
    { mode: 'demo', stage: 'training', seed: 777, rounds: 2, time: 99, intro: false, p1: { char: 'deepseek', control: 'cpu', level: 2 }, p2: { char: 'deepseek', palette: 1, control: 'cpu', level: 5 } },
    { mode: 'demo', stage: 'training', seed: 4343, rounds: 2, time: 99, intro: true, p1: { char: 'gpt', control: 'cpu', level: 5 }, p2: { char: 'claude', control: 'cpu', level: 3 } },
    { mode: 'demo', stage: 'training', seed: 818, rounds: 2, time: 99, intro: false, p1: { char: 'deepseek', control: 'cpu', level: 4 }, p2: { char: 'gpt', control: 'cpu', level: 4 } },
    { mode: 'demo', stage: 'training', seed: 919, rounds: 2, time: 99, intro: false, p1: { char: 'gpt', control: 'cpu', level: 3 }, p2: { char: 'gpt', palette: 1, control: 'cpu', level: 3 } }];
  for (const c of det) { jobs.push({ det: 1, cfg: c }); jobs.push({ det: 2, cfg: c }); }
  const t0 = Date.now();
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(pages.map(async p => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await p.evaluate(([c, o]) => window.SIM(c, o), [jobs[i].cfg, { draw: !!args.draw, plans: !!args.plans, mu: args.mu ? Object.fromEntries(String(args.mu).split(',').map(e => { const [k, kv] = e.split(':'); return [k, Object.fromEntries(kv.split(';').map(x => { const [a, b] = x.split('='); return [a, +b]; }))]; })) : null, off: args.off ? Object.fromEntries(String(args.off).split(',').map(k => [k, 1])) : null }]);
    }
  }));
  const secs = (Date.now() - t0) / 1000;

  // ---- report
  let violations = 0, unfinished = 0;
  const table = {}, usage = {}, dmg = {}, plans = {}, lens = [];
  let ticks = 0;
  results.forEach((r, i) => {
    const j = jobs[i];
    ticks += r.t;
    if (r.viol.length) { violations += r.viol.length; console.log('VIOLATION seed', j.cfg.seed, r.viol.join(' | ')); }
    if (!r.finished) unfinished++;
    if (j.det) return;
    const key = j.ca + '-' + j.cb + ' ' + j.la + 'v' + j.lb;
    const T = table[key] || (table[key] = { a: j.ca, b: j.cb, n: 0, wa: 0, draw: 0, rounds: 0, len: 0, timeups: 0 });
    T.n++;
    const aSide = j.swap ? 1 : 0;
    const w = r.result ? r.result.winner : -1;
    if (w === -1) T.draw++; else if (w === aSide) T.wa++;
    T.rounds += r.roundLen.length;
    T.len += r.roundLen.reduce((a, b) => a + b, 0);
    T.timeups += (r.result.finishes[0].concat(r.result.finishes[1])).filter(x => x === 'time').length;
    lens.push(...r.roundLen);
    const chars = j.swap ? [j.cb, j.ca] : [j.ca, j.cb];
    for (let s = 0; s < 2; s++) {
      const c = chars[s] + (j.ca === j.cb ? '' : ' vs ' + chars[1 - s]);
      usage[c] = usage[c] || {}; dmg[c] = dmg[c] || {}; plans[c] = plans[c] || {};
      for (const k in r.usage[s]) usage[c][k] = (usage[c][k] || 0) + r.usage[s][k];
      for (const k in r.dmgBy[s]) dmg[c][k] = (dmg[c][k] || 0) + r.dmgBy[s][k];
      for (const k in r.plans[s]) plans[c][k] = (plans[c][k] || 0) + r.plans[s][k];
    }
  });
  console.log('\nBALANCE (A vs B, both side assignments)');
  console.log('pair                 matches   A win%  draws  avg round (s)  time-ups/round');
  for (const k in table) {
    const T = table[k];
    console.log(k.padEnd(20), String(T.n).padStart(7), ((100 * T.wa / Math.max(1, T.n - T.draw)).toFixed(1) + '%').padStart(8), String(T.draw).padStart(6),
      (T.len / Math.max(1, T.rounds) / 60).toFixed(1).padStart(14), (T.timeups / Math.max(1, T.rounds)).toFixed(2).padStart(15));
  }
  if (!args.quiet) {
    for (const c in usage) {
      const tot = Object.values(usage[c]).reduce((a, b) => a + b, 0);
      const top = Object.entries(usage[c]).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(1) + '%');
      console.log('\nmove usage ' + c + ': ' + top.join(', '));
    }
    for (const c in dmg) {
      const tot = Object.entries(dmg[c]).filter(e => e[0][0] !== '_').reduce((a, b) => a + b[1], 0);
      console.log('damage by source ' + c + ' (total ' + tot + ', counters ' + (dmg[c]._counters || 0) + (dmg[c]._grab ? ', grabs ' + dmg[c]._grab : '') + (dmg[c]._erase ? ', erased ' + dmg[c]._erase : '') + '): ' +
        Object.entries(dmg[c]).filter(e => e[0][0] !== '_').sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(1) + '%').join(', '));
    }
    if (args.plans) for (const c in plans) console.log('AI plans ' + c + ': ' + Object.entries(plans[c]).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, v]) => k + ' ' + v).join(', '));
  }
  // determinism
  let detOk = true;
  for (let i = 0; i < jobs.length; i++) if (jobs[i].det === 1) { if (results[i].snap !== results[i + 1].snap) { detOk = false; console.log('DETERMINISM FAIL seed', jobs[i].cfg.seed); } }
  console.log('\ndeterminism:', detOk ? 'OK' : 'FAIL', '| violations:', violations, '| unfinished:', unfinished,
    '| console errors:', consoleErrs.length, consoleErrs.slice(0, 5).join(' / '));
  console.log('matches:', results.length, 'ticks:', ticks, 'time:', secs.toFixed(1) + 's', '(' + Math.round(ticks / secs) + ' ticks/s)');
  await browser.close();
  process.exit(violations || unfinished || !detOk || consoleErrs.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });
