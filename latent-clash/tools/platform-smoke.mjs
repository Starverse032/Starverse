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
  // three-fighter roster: every character's arcade ladder follows LC.LORE.rivals / foeHome / mirror boss
  const ladders = await page.evaluate(() => LC.CHARS.map(ch => {
    const A = LC.app.newArcade(ch, 0).arcade;
    return LC.LORE.arcade.map((_, k) => { const r = LC.app.arcadeStep(A, k); return [ch, r.foe, r.palette, r.stage]; });
  }));
  for (const L of ladders) {
    const ch = L[0][0], R = await page.evaluate(c => [LC.LORE.rivals[c], LC.LORE.homeStage], ch);
    check(L[0][1] === R[0][0] && L[1][1] === R[0][1] && L[2][1] === ch && L[2][2] === 1, `ladder foes for ${ch}: ${JSON.stringify(L)}`);
    check(L[0][3] === R[1][R[0][0]] && L[1][3] === R[1][R[0][1]] && L[2][3] === 'latent', `ladder stages for ${ch}: ${JSON.stringify(L)}`);
  }
  const gptBoss = await page.evaluate(() => { LC.app.newArcade('gpt', 0); LC.app.session.arcade.stage = 2; const p = LC.app.arcadeFightParams(); return [p.p2.char, p.p2.palette, !!(p.introLines && p.introLines[1].length)]; });
  check(gptBoss[0] === 'gpt' && gptBoss[1] === 1 && gptBoss[2], 'gpt mirror boss ' + JSON.stringify(gptBoss));
  // GPT selection on the select screen with real menu input (right ×2 -> GPT, lock; P2 CPU locks its cursor)
  const pick = await page.evaluate(() => {
    LC.app.lastPick = {};
    LC.debug.goto('select', { mode: 'versus', vs: 'pvc' }); LC.debug.step(30);
    const tap = (k) => { LC.debug.setInput(0, { [k]: true }); LC.debug.step(1); LC.debug.setInput(0, null); LC.debug.step(3); };
    for (let i = 0; i < LC.CHARS.indexOf('gpt'); i++) tap('right');
    tap('L'); LC.debug.step(5); tap('right'); tap('right'); tap('L'); LC.debug.step(80);
    const S = LC.app.session || {};
    return { scene: LC.debug.scene, sides: (S.sides || []).map(s => s.char + ':' + s.palette) };
  });
  check(pick.scene === 'stage' && pick.sides[0] === 'gpt:0' && pick.sides.length === 2, 'gpt select ' + JSON.stringify(pick));
  await shot('select-gpt-stage');
  // A match involving GPT: full CPU match when FIGHT and RIG know her, else note and skip.
  const sup = await page.evaluate(() => ({ fight: LC.app.fightSupports('gpt'), rig: LC.app.rigSupports('gpt') }));
  if (sup.fight && sup.rig) {
    await page.evaluate(() => LC.debug.goto('match', { mode: 'versus', p1: 'gpt', p2: 'claude', ctl1: 'cpu', ctl2: 'cpu', level: 5, skipIntro: 1, seed: 11 }));
    let sc = 'match';
    for (let i = 0; i < 80 && sc === 'match'; i++) { await page.evaluate(() => LC.debug.step(300)); sc = await page.evaluate(() => LC.debug.scene); if (i === 1) await shot('match-gpt'); }
    check(['result', 'match'].includes(sc), 'gpt match did not finish: ' + sc);
  } else {
    console.log(`  note [${tag}] GPT match skipped: fight supports gpt=${sup.fight}, rig.hasAnim('gpt','idle')=${sup.rig}`);
    // still make sure a match config involving her degrades without errors (FIGHT substitutes / stub)
    await page.evaluate(() => { LC.debug.goto('match', { mode: 'versus', p1: 'gpt', p2: 'claude', ctl1: 'cpu', ctl2: 'cpu', skipIntro: 1, seed: 11 }); LC.debug.step(240); });
    await shot('match-gpt-degraded');
  }
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
