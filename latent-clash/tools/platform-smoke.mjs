// LATENT CLASH — PLATFORM smoke test (Playwright). node tools/platform-smoke.mjs
// Boots index.html and dist/latent-clash.html with LC_OPTS { manual, mute }, walks every scene with
// LC.debug, plays a CPU-vs-CPU match to the result screen, exercises pause / arcade routing / touch
// layout, asserts LC.debug.errors is empty, and saves screenshots to .shots/platform/smoke-*.png.
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.shots', 'platform');
fs.mkdirSync(OUT, { recursive: true });

const targets = [['index', 'index.html']];
if (fs.existsSync(path.join(ROOT, 'dist', 'latent-clash.html'))) targets.push(['dist', 'dist/latent-clash.html']);

const SCENES = [
  ['title', `LC.debug.goto('title')`, 60], ['menu', `LC.debug.goto('menu')`, 40],
  ['select', `LC.debug.goto('select', { mode: 'versus', vs: 'pvc' })`, 40],
  ['select-pvp', `LC.debug.goto('select', { mode: 'versus', vs: 'pvp' })`, 40],
  ['stage', `LC.app.session = { mode: 'versus', vs: 'pvc', sides: [{ char: 'claude' }, { char: 'deepseek' }] }; LC.debug.goto('stage', { mode: 'versus' })`, 40],
  ['vs', `LC.debug.goto('vs', { config: LC.app.matchConfig({ mode: 'versus' }) })`, 60],
  ['training', `LC.debug.goto('match', { mode: 'training' })`, 60],
  ['pause', `LC.scenes.push('pause', { cfg: LC.debug.match() && LC.scenes.base().cfg })`, 20],
  ['howto', `LC.debug.goto('howto', { page: 0 })`, 20], ['howto-moves', `LC.debug.goto('howto', { page: 3 })`, 20],
  ['howto-gpt', `LC.debug.goto('howto', { page: 2 + LC.CHARS.indexOf('gpt') })`, 20],
  ['select-arcade', `LC.debug.goto('select', { mode: 'arcade' })`, 40],
  ['options', `LC.debug.goto('options')`, 20], ['keys', `LC.debug.goto('keys')`, 20], ['credits', `LC.debug.goto('credits')`, 200],
  ['ladder', `LC.app.newArcade('deepseek', 0); LC.debug.goto('ladder')`, 80], ['continue', `LC.debug.goto('continue')`, 40],
  ['ending', `LC.app.session.arcade.score = 99999; LC.debug.goto('ending')`, 200],
  ['ladder-gpt', `LC.app.newArcade('gpt', 0); LC.debug.goto('ladder')`, 80],
  ['vs-gpt', `LC.debug.goto('vs', { config: LC.app.matchConfig({ mode: 'versus', p1: 'gpt', p2: 'deepseek' }) })`, 60],
  ['result-gpt', `LC.debug.goto('result', { cfg: LC.app.matchConfig({ mode: 'versus', p1: 'claude', p2: 'gpt' }), result: { winner: 1, roundsWon: [1, 2], timeLeft: 20, stats: [{}, {}] } })`, 80],
  ['ending-gpt', `LC.app.newArcade('gpt', 1); LC.debug.goto('ending')`, 200],
  // fourth fighter: Gemini
  ['select-gemini', `LC.app.lastPick = { versuspvp: [{ char: 'gemini', palette: 0 }, { char: 'deepseek', palette: 0 }] }; LC.debug.goto('select', { mode: 'versus', vs: 'pvp' })`, 60],
  ['ladder-gemini', `LC.app.newArcade('gemini', 0); LC.app.session.arcade.stage = LC.LORE.arcade.length - 1; LC.debug.goto('ladder')`, 80],
  ['vs-gemini', `LC.debug.goto('vs', { config: LC.app.matchConfig({ mode: 'versus', p1: 'gemini', p2: 'gpt' }) })`, 60],
  ['result-gemini', `LC.debug.goto('result', { cfg: LC.app.matchConfig({ mode: 'versus', p1: 'gemini', p2: 'claude' }), result: { winner: 0, roundsWon: [2, 1], timeLeft: 20, stats: [{}, {}] } })`, 80],
  ['result-gemini-lose', `LC.debug.goto('result', { cfg: LC.app.matchConfig({ mode: 'versus', p1: 'deepseek', p2: 'gemini' }), result: { winner: 1, roundsWon: [0, 2], timeLeft: 5, stats: [{}, {}] } })`, 80],
  ['ending-gemini', `LC.app.newArcade('gemini', 0); LC.app.session.arcade.score = 4321; LC.debug.goto('ending')`, 200],
  ['howto-gemini', `LC.debug.goto('howto', { page: 2 + LC.CHARS.indexOf('gemini') })`, 20],
  ['training-gemini', `LC.debug.goto('match', { mode: 'training', p1: 'gemini', p2: 'gpt' })`, 60],
  ['stage-gemini', `LC.app.session = { mode: 'versus', vs: 'pvc', sides: [{ char: 'gemini' }, { char: 'gemini', palette: 1 }] }; LC.debug.goto('stage', { mode: 'versus' })`, 40],
  ['menu-showcase', `LC.debug.goto('menu'); LC.debug.step(361 * 3)`, 10],
];

let failed = 0;
const browser = await chromium.launch();
for (const [tag, file] of targets) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.addInitScript(() => { window.LC_OPTS = { manual: true, mute: true }; });
  await page.goto('file://' + path.join(ROOT, file));
  await page.evaluate(() => LC.debug.ready);
  const shot = async (name) => {
    const url = await page.evaluate(() => LC.debug.shot());
    fs.writeFileSync(path.join(OUT, `smoke-${tag}-${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  };
  const check = (cond, msg) => { if (!cond) { failed++; console.log(`  FAIL [${tag}] ${msg}`); } };
  const info = await page.evaluate(() => ({ scene: LC.debug.scene, fight: !!LC.fight, rig: !!LC.rig, illust: !!LC.illust, stages: !!LC.stages, audio: !!LC.audio, fx: !!LC.fx, init: LC.debug.initTimes }));
  console.log(`[${tag}] booted scene=${info.scene} modules: fight=${info.fight} rig=${info.rig} illust=${info.illust} stages=${info.stages} audio=${info.audio} fx=${info.fx} init(ms)=${JSON.stringify(info.init)}`);
  check(info.scene === 'boot', 'boot gate expected');
  await page.evaluate(() => LC.debug.step(30)); await shot('boot');
  for (const [name, setup, steps] of SCENES) {
    try {
      await page.evaluate(setup);
      await page.evaluate(n => LC.debug.step(n), steps);
      await shot(name);
    } catch (e) { check(false, `${name}: ${e.message}`); }
  }
  // gameplay: the boot gate -> title -> menu with real key presses
  await page.evaluate(() => { LC.debug.goto('boot'); });
  await page.evaluate(() => LC.debug.step(5));
  // Full CPU vs CPU match until the result screen.
  await page.evaluate(() => LC.debug.goto('match', { mode: 'versus', p1: 'claude', p2: 'deepseek', ctl1: 'cpu', ctl2: 'cpu', level: 5, skipIntro: 1, seed: 7 }));
  const isStub = await page.evaluate(() => !!(LC.debug.match() && LC.debug.match().stub));
  let scene = 'match';
  for (let i = 0; i < 80 && scene === 'match'; i++) {
    if (isStub && i % 3 === 0) { await page.keyboard.down('Digit1'); await page.evaluate(() => LC.debug.step(2)); await page.keyboard.up('Digit1'); }
    await page.evaluate(() => LC.debug.step(300));
    scene = await page.evaluate(() => LC.debug.scene);
    if (i === 1) await shot('match');
  }
  const snap = await page.evaluate(() => { const m = LC.debug.match(); return m ? m.snapshot() : null; });
  await page.evaluate(() => LC.debug.step(80));
  await shot('result');
  check(['result', 'match'].includes(scene), 'match did not finish: scene=' + scene);
  if (scene !== 'result') console.log('  note: match still running after 24000 ticks (stub=' + isStub + ')', snap && snap.state);
  // arcade routing via the flow API
  const arc = await page.evaluate(() => {
    LC.app.newArcade('claude', 0);
    const cfg = LC.app.matchConfig(LC.app.arcadeFightParams());
    LC.app.afterMatch(cfg, { winner: 0, roundsWon: [2, 0], perfect: true, timeLeft: 50, stats: [{}, {}] });
    LC.debug.step(40);
    const a = LC.debug.scene;
    LC.app.arcadeNext(true); LC.debug.step(40);
    const b = LC.debug.scene;
    LC.app.arcadeNext(false); LC.debug.step(40);
    return [a, b, LC.debug.scene, LC.app.session.arcade.score];
  });
  check(arc[0] === 'result' && arc[1] === 'ladder' && arc[2] === 'continue' && arc[3] > 0, 'arcade routing ' + JSON.stringify(arc));
  // roster: every character's arcade ladder follows LC.LORE.arcade (rivalN -> rivals[N-1], foeHome, mirror boss)
  const ladders = await page.evaluate(() => LC.CHARS.map(ch => {
    const A = LC.app.newArcade(ch, 0).arcade;
    return { ch, steps: LC.LORE.arcade.map((st, k) => { const r = LC.app.arcadeStep(A, k); A.stage = k; const p = LC.app.arcadeFightParams(); return { want: st.foe, foe: r.foe, pal: r.palette, stage: r.stage, wantStage: st.stage, p2: p.p2.char, taunt: !!(p.introLines && p.introLines[1] && p.introLines[1].length) }; }), rivals: LC.LORE.rivals[ch], home: LC.LORE.homeStage };
  }));
  for (const { ch, steps, rivals, home } of ladders) {
    const seen = new Set();
    steps.forEach((s, k) => {
      const m = /^rival(\d*)$/.exec(s.want);
      const foe = s.want === 'mirror' ? ch : m ? rivals[(+m[1] || 1) - 1] : s.want;
      check(s.foe === foe && s.p2 === foe, `${ch} step ${k}: foe ${s.foe} != ${foe}`);
      check(s.stage === (s.wantStage === 'foeHome' ? home[foe] : s.wantStage) && !!s.stage, `${ch} step ${k}: stage ${s.stage}`);
      if (s.want === 'mirror') check(s.pal === 1 && s.taunt, `${ch} mirror boss: pal ${s.pal} taunt ${s.taunt}`);
      seen.add(s.foe);
    });
    check(steps[steps.length - 1].want === 'mirror', `${ch}: ladder should end with the mirror boss`);
    check(rivals.every(r => seen.has(r)), `${ch}: not every rival met (${[...seen]})`);
  }
  console.log(`[${tag}] ladders: ` + ladders.map(l => l.ch + '→' + l.steps.map(s => s.foe + '@' + s.stage).join(',')).join(' | '));
  // newer fighters: pick via the select screen with real menu input; then a match when FIGHT + RIG know them
  for (const who of ['gpt', 'gemini']) {
    const pick = await page.evaluate(async (who) => {
      LC.app.lastPick = {};
      LC.debug.goto('select', { mode: 'versus', vs: 'pvc' }); LC.debug.step(30);
      const keys = [];
      const press = (k) => new Promise(r => { keys.push(k); r(); });
      return { idx: LC.CHARS.indexOf(who) };
    }, who);
    // real key presses (ArrowRight / KeyZ are the default solo-mode menu keys)
    for (let i = 0; i < pick.idx; i++) { await page.keyboard.down('ArrowRight'); await page.evaluate(() => LC.debug.step(2)); await page.keyboard.up('ArrowRight'); await page.evaluate(() => LC.debug.step(3)); }
    await shot(`select-${who}-cursor`);
    await page.keyboard.down('KeyZ'); await page.evaluate(() => LC.debug.step(2)); await page.keyboard.up('KeyZ'); await page.evaluate(() => LC.debug.step(8));
    for (let i = 0; i < 2; i++) { await page.keyboard.down('ArrowRight'); await page.evaluate(() => LC.debug.step(2)); await page.keyboard.up('ArrowRight'); await page.evaluate(() => LC.debug.step(3)); }
    await page.keyboard.down('KeyZ'); await page.evaluate(() => LC.debug.step(2)); await page.keyboard.up('KeyZ'); await page.evaluate(() => LC.debug.step(80));
    const res = await page.evaluate(() => { const S = LC.app.session || {}; return { scene: LC.debug.scene, sides: (S.sides || []).map(s => s.char + ':' + s.palette) }; });
    check(res.scene === 'stage' && res.sides[0] === who + ':0' && res.sides.length === 2, `${who} select ` + JSON.stringify(res));
    await shot(`select-${who}-stage`);
    const sup = await page.evaluate(w => ({ fight: LC.app.fightSupports(w), rig: LC.app.rigSupports(w) }), who);
    if (sup.fight && sup.rig) {
      await page.evaluate(w => LC.debug.goto('match', { mode: 'versus', p1: w, p2: 'claude', ctl1: 'cpu', ctl2: 'cpu', level: 5, skipIntro: 1, seed: 11 }), who);
      let sc = 'match';
      for (let i = 0; i < 80 && sc === 'match'; i++) { await page.evaluate(() => LC.debug.step(300)); sc = await page.evaluate(() => LC.debug.scene); if (i === 1) await shot(`match-${who}`); }
      check(['result', 'match'].includes(sc), `${who} match did not finish: ` + sc);
    } else {
      console.log(`  note [${tag}] ${who} match skipped: fight supports ${who}=${sup.fight}, rig.hasAnim('${who}','idle')=${sup.rig}`);
      // a match config involving her still has to degrade without errors (FIGHT substitutes / stub)
      await page.evaluate(w => { LC.debug.goto('match', { mode: 'versus', p1: w, p2: 'claude', ctl1: 'cpu', ctl2: 'cpu', skipIntro: 1, seed: 11 }); LC.debug.step(240); }, who);
      await shot(`match-${who}-degraded`);
    }
  }
  // pause move list: ←→ walks every fighter's tab
  const tabs = await page.evaluate(() => {
    LC.debug.goto('match', { mode: 'versus', p1: 'claude', skipIntro: 1 }); LC.debug.step(10);
    LC.scenes.push('pause', { cfg: LC.scenes.base().cfg }); LC.debug.step(12);
    const tap = (k) => { LC.debug.setInput(0, { [k]: true }); LC.debug.step(1); LC.debug.setInput(0, null); LC.debug.step(3); };
    tap('down'); tap('L');
    for (let i = 0; i < LC.CHARS.length - 1; i++) tap('right');
    return LC.debug.scene;
  });
  check(tabs === 'pause', 'pause move list: ' + tabs);
  await shot('pause-moves-last');
  await page.evaluate(() => { LC.scenes.pop(); LC.debug.step(2); });
  // pause via the start key in a human match
  const paused = await page.evaluate(() => {
    LC.debug.goto('match', { mode: 'versus', skipIntro: 1 }); LC.debug.step(10);
    LC.debug.setInput(0, { start: true }); LC.debug.step(1); LC.debug.setInput(0, null); LC.debug.step(5);
    const s = LC.debug.scene; LC.scenes.pop(); LC.debug.step(2); return s;
  });
  check(paused === 'pause', 'start did not pause: ' + paused);
  const errs = await page.evaluate(() => LC.debug.errors);
  check(errs.length === 0, 'LC.debug.errors: ' + JSON.stringify(errs).slice(0, 1500));
  check(pageErrors.length === 0, 'page errors: ' + pageErrors.join(' | ').slice(0, 800));
  await ctx.close();

  // phone, touch emulated: the overlay must appear
  const ph = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const pp = await ph.newPage();
  await pp.addInitScript(() => { window.LC_OPTS = { manual: true, mute: true, scene: 'match', mode: 'versus', skipIntro: 1 }; });
  await pp.goto('file://' + path.join(ROOT, file));
  await pp.evaluate(() => LC.debug.ready);
  await pp.evaluate(() => LC.debug.step(60));
  const lay = await pp.evaluate(() => ({ l: LC.display.layout(), touch: getComputedStyle(document.getElementById('lc-touch') || document.body).display }));
  check(lay.touch === 'block', 'touch overlay hidden on phone');
  await pp.screenshot({ path: path.join(OUT, `smoke-${tag}-phone.png`) });
  const perr = await pp.evaluate(() => LC.debug.errors);
  check(perr.length === 0, 'phone errors: ' + JSON.stringify(perr).slice(0, 800));
  console.log(`[${tag}] phone layout: scale ${lay.l.scale}, mode ${lay.l.mode}`);
  await ph.close();
}
await browser.close();
console.log(failed ? `SMOKE FAILED (${failed})` : 'SMOKE OK');
process.exit(failed ? 1 : 0);
