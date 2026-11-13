#!/usr/bin/env node
/* LATENT CLASH — FIGHT headless simulator.
 * Runs many CPU-vs-CPU matches at unlimited speed (no drawing) in headless Chromium, asserts
 * invariants every tick, checks determinism, and prints a balance table.
 *
 *   node tools/fight-sim.mjs [--n=12] [--levels=1,3,5] [--real] [--seed=1] [--draw]
 *     --n       matches per (level, side) pairing (each pairing runs both side assignments)
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
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const N = +(args.n || 12);
const LEVELS = String(args.levels || '1,3,5').split(',').map(Number);
const SEED = +(args.seed || 1);
const url = 'file://' + root + '/dev/fight-sandbox.html?manual=1' + (args.real ? '' : '&stubs=all');

function pageRunner() {
  // executed in the page
  window.SIM = function (cfg, opts) {
    const F = LC.fight, T = F.T;
    F.headless = !opts.draw;
    const m = F.createMatch(cfg);
    const viol = [];
    const usage = [{}, {}];
    m.aiHook = function (f, mv) { usage[f.side][mv.id] = (usage[f.side][mv.id] || 0) + 1; };
    const dmgBy = [{}, {}], oc = m.onContact;
    m.onContact = function (att, vic, what, dmg, h, kind, counter) {
      if (what === 'hit') { const k = kind === 'throw' ? 'throw' : (h && h.fx && /sparkHit|waveHit/.test(h.fx)) ? 'proj' : (att.mv ? att.mv.id : kind); dmgBy[att.side][k] = (dmgBy[att.side][k] || 0) + dmg; }
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
    return { t, finished: m.finished, result: m.result, viol, usage, dmgBy, roundLen, snap, errs: FS.errors.slice(0, 5) };
  };
}

async function main() {
  const browser = await chromium.launch();
  const W = 4;
  const pages = [];
  const consoleErrs = [];
  for (let i = 0; i < W; i++) {
    const p = await browser.newPage();
    p.on('console', msg => { if (msg.type() === 'error') consoleErrs.push(msg.text()); });
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
  for (const [la, lb] of pairs) for (let k = 0; k < N; k++) for (const swap of [false, true]) {
    const cl = { char: 'claude', control: 'cpu', level: la }, ds = { char: 'deepseek', control: 'cpu', level: lb };
    jobs.push({ la, lb, swap, cfg: { mode: 'demo', stage: 'training', seed: seed++, rounds: 2, time: 99, intro: false, p1: swap ? ds : cl, p2: swap ? cl : ds } });
  }
  // determinism check jobs
  const det = [{ mode: 'demo', stage: 'training', seed: 4242, rounds: 2, time: 99, intro: true, p1: { char: 'claude', control: 'cpu', level: 4 }, p2: { char: 'deepseek', control: 'cpu', level: 4 } },
    { mode: 'demo', stage: 'training', seed: 777, rounds: 2, time: 99, intro: false, p1: { char: 'deepseek', control: 'cpu', level: 2 }, p2: { char: 'deepseek', palette: 1, control: 'cpu', level: 5 } }];
  for (const c of det) { jobs.push({ det: 1, cfg: c }); jobs.push({ det: 2, cfg: c }); }
  const t0 = Date.now();
  const results = new Array(jobs.length);
  let next = 0;
  await Promise.all(pages.map(async p => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await p.evaluate(([c, o]) => window.SIM(c, o), [jobs[i].cfg, { draw: !!args.draw }]);
    }
  }));
  const secs = (Date.now() - t0) / 1000;

  // ---- report
  let violations = 0, unfinished = 0;
  const table = {}, usage = { claude: {}, deepseek: {} }, dmg = { claude: {}, deepseek: {} }, lens = [];
  let ticks = 0;
  results.forEach((r, i) => {
    const j = jobs[i];
    ticks += r.t;
    if (r.viol.length) { violations += r.viol.length; console.log('VIOLATION seed', j.cfg.seed, r.viol.join(' | ')); }
    if (!r.finished) unfinished++;
    if (j.det) return;
    const key = j.la + 'v' + j.lb;
    const T = table[key] || (table[key] = { n: 0, claude: 0, draw: 0, rounds: 0, len: 0, timeups: 0, perfect: 0 });
    T.n++;
    const clSide = j.swap ? 1 : 0;
    const w = r.result ? r.result.winner : -1;
    if (w === -1) T.draw++; else if (w === clSide) T.claude++;
    T.rounds += r.roundLen.length;
    T.len += r.roundLen.reduce((a, b) => a + b, 0);
    T.timeups += (r.result.finishes[0].concat(r.result.finishes[1])).filter(x => x === 'time').length;
    lens.push(...r.roundLen);
    const chars = j.swap ? ['deepseek', 'claude'] : ['claude', 'deepseek'];
    for (let s = 0; s < 2; s++) for (const k in r.usage[s]) usage[chars[s]][k] = (usage[chars[s]][k] || 0) + r.usage[s][k];
    for (let s = 0; s < 2; s++) for (const k in r.dmgBy[s]) dmg[chars[s]][k] = (dmg[chars[s]][k] || 0) + r.dmgBy[s][k];
  });
  console.log('\nBALANCE (Claude vs DeepSeek, both side assignments)');
  console.log('pair   matches  Claude win%  draws  avg round (s)  time-ups/round');
  for (const k in table) {
    const T = table[k];
    console.log(k.padEnd(6), String(T.n).padStart(7), ((100 * T.claude / Math.max(1, T.n - T.draw)).toFixed(1) + '%').padStart(12), String(T.draw).padStart(6),
      (T.len / Math.max(1, T.rounds) / 60).toFixed(1).padStart(14), (T.timeups / Math.max(1, T.rounds)).toFixed(2).padStart(15));
  }
  for (const c in usage) {
    const tot = Object.values(usage[c]).reduce((a, b) => a + b, 0);
    const top = Object.entries(usage[c]).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(1) + '%');
    console.log('\nmove usage ' + c + ': ' + top.join(', '));
  }
  for (const c in dmg) {
    const tot = Object.entries(dmg[c]).filter(e => e[0][0] !== '_').reduce((a, b) => a + b[1], 0);
    console.log('damage by source ' + c + ' (total ' + tot + ', counters ' + (dmg[c]._counters || 0) + '): ' +
      Object.entries(dmg[c]).filter(e => e[0][0] !== '_').sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(1) + '%').join(', '));
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
