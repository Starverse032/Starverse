#!/usr/bin/env node
/* LATENT CLASH — realtime audio smoke test (AUDIO module tooling).
 *   node tools/audio-smoke.mjs
 * Loads src/audio through the dev loader in headless Chromium (dev/audio-render.html), checks
 * silent no-ops before unlock, unlocks inside a real click, plays every contract SFX / voice /
 * track, exercises the API (volume, duck, pause, fades, rapid track switching, hidden tab) and
 * fails on any console error/warning, missing contract name or leaked music voices. */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SFX = ('ui.move ui.confirm ui.cancel ui.start ui.error ui.pause ui.lock text.blip hit.light hit.medium hit.heavy ' +
  'hit.special hit.counter block.light block.heavy whiff.light whiff.medium whiff.heavy jump land dash throw.grab ' +
  'throw.slam throw.tech down ko super.flash super.charge meter.full counter.catch timer.tick ann.round ann.fight ' +
  'ann.ko ann.perfect ann.timeup ann.win claude.spark claude.sparkHit claude.sonnet claude.haiku claude.guardrail ' +
  'claude.beam deepseek.wave deepseek.waveHit deepseek.breach deepseek.dive deepseek.emerge deepseek.chain ' +
  'deepseek.diveKick deepseek.whale gpt.breath gpt.rise gpt.call gpt.callSlam gpt.roar gpt.super ' +
  'gemini.star gemini.starHit gemini.rise gemini.twin gemini.twinStrike gemini.blink gemini.super').split(' ');
const MUSIC = ['title', 'select', 'vs', 'stage.library', 'stage.abyss', 'stage.latent', 'stage.training', 'victory', 'continue', 'ending'];
const KINDS = ['light', 'medium', 'heavy', 'special', 'super', 'hurt', 'ko', 'win', 'intro'];
const CHARS = ['claude', 'deepseek', 'gpt', 'gemini'];

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
const page = await browser.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => logs.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(path.join(ROOT, 'dev/audio-render.html')).href);
await page.waitForFunction(() => window.RENDER_READY === true);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = ms => page.waitForTimeout(ms);

console.log('manifest / list');
const L = await ev(() => ({ man: window.LC_MANIFEST.audio, list: LC.audio.list() }));
check(!L.man.includes('mix.js') || L.man.indexOf('mix.js') > L.man.lastIndexOf('sfx-chars.js'), 'mix.js loads after all sfx-*.js');
check(L.man[0] === 'core.js' && L.man.indexOf('engine.js') > L.man.indexOf('mixer.js'), 'core first, engine after mixer');
for (const n of SFX) if (!L.list.sfx.includes(n)) check(false, 'missing sfx ' + n);
for (const n of MUSIC) if (!L.list.music.includes(n)) check(false, 'missing track ' + n);
check(SFX.every(n => L.list.sfx.includes(n)) && MUSIC.every(n => L.list.music.includes(n)), 'all contract names registered');

console.log('before unlock (silent no-ops)');
const pre = await ev(() => {
  const A = LC.audio; let threw = null;
  try {
    A.sfx('hit.light'); A.voice('claude', 'light'); A.duck(0.5, 1); A.setPaused(true); A.setPaused(false);
    A.setVolume('music', 0.5); A.music('title', { fade: 0.3 });
  } catch (e) { threw = e.message; }
  return { threw, state: A.state(), cur: A.currentTrack(), vol: A.getVolume('music') };
});
check(!pre.threw && pre.state === 'locked', 'calls before unlock do not throw, no context (' + pre.state + ')');
check(pre.cur === 'title' && pre.vol === 0.5, 'locked music request remembered, volume stored');

await page.evaluate(() => { const b = document.createElement('button'); b.id = 'u'; b.textContent = 'unlock'; b.onclick = () => LC.audio.unlock(); document.body.appendChild(b); });
await page.click('#u');
await page.waitForFunction(() => LC.audio.state() === 'running', null, { timeout: 5000 });
await wait(400);
const st0 = await ev(() => ({ cur: LC.audio.currentTrack(), pos: LC.audio.position() }));
check(st0.cur === 'title' && st0.pos, 'pending music started on unlock');

console.log('every SFX / voice');
for (const n of SFX) { await ev(n => LC.audio.sfx(n, { vol: 0.8, pan: 0.2, pitch: 1.05 }), n); await wait(15); }
for (const c of CHARS) for (const k of KINDS) { await ev(([c, k]) => LC.audio.voice(c, k), [c, k]); await wait(15); }
await wait(300);

console.log('every track (~2 s each)');
for (const t of MUSIC) {
  await ev(t => LC.audio.music(t, { fade: 0.2 }), t);
  await wait(2000);
  const s = await ev(() => ({ cur: LC.audio.currentTrack(), pos: LC.audio.position(), n: LC.audio._st.mx.tracks.length }));
  check(s.cur === t && s.n <= 2, t + ' plays (pos ' + JSON.stringify(s.pos) + ', instances ' + s.n + ')');
}

console.log('API');
const api = await ev(async () => {
  const A = LC.audio, mx = A._st.mx, r = {};
  const liveN = () => mx.tracks.filter(t => !t.stopping && !t.done).length;
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  A.setVolume('sfx', 0.3); r.vol = A.getVolume('sfx'); A.setVolume('sfx', 2); r.clamp = A.getVolume('sfx'); A.setVolume('sfx', 0.9);
  A.music('stage.abyss', { fade: 0 }); A.music('stage.abyss'); r.same = liveN();
  A.music('stage.abyss', { restart: true, fade: 0.1 }); r.restart = A.currentTrack();
  for (let i = 0; i < 30; i++) A.music(['title', 'select', 'stage.latent'][i % 3], { fade: 0.4 });
  await sleep(100); r.rapid = mx.tracks.length; r.rapidLive = liveN();
  await sleep(900); r.settled = mx.tracks.length;
  A.duck(0.6, 0.5); A.setPaused(true); await sleep(200); A.setPaused(false);
  A.music('title', { fade: 2 }); await sleep(1200); r.fading = A._st.mx.tracks.filter(t => t.stopping).length; A.music(null, { fade: 0.2 }); r.stopLive = liveN(); await sleep(1300); r.stopped = mx.tracks.length; r.cur = A.currentTrack();
  A.music('stage.library', { fade: 0 }); await sleep(300);
  return r;
});
check(api.vol === 0.3 && api.clamp === 1, 'setVolume/getVolume + clamp');
check(api.same === 1, 'same track again is a no-op (' + api.same + ' instance)');
check(api.restart === 'stage.abyss', 'restart: true');
check(api.rapid <= 3 && api.rapidLive === 1 && api.settled === 1, 'rapid switching does not stack (' + api.rapid + ' instances during fades, ' + api.settled + ' after)');
check(api.fading === 1, 'long fade keeps the old track scheduled through the fade');
check(api.stopLive === 0 && api.stopped === 0 && api.cur === null, 'music(null) stops and frees the instances');

console.log('hidden tab');
const hid = await ev(async () => {
  const A = LC.audio, ctx = A._st.ctx, sleep = ms => new Promise(r => setTimeout(r, ms));
  const p0 = A.position();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  await sleep(1500); const s1 = ctx.state;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
  await sleep(1500);
  return { s1, s2: ctx.state, p0, p1: A.position(), n: A._st.mx.tracks.filter(t => !t.stopping).length };
});
check(hid.s1 === 'suspended' && hid.s2 === 'running', 'suspends while hidden, resumes after (' + hid.s1 + ' -> ' + hid.s2 + ')');
check(hid.p1 && hid.p1.seconds > hid.p0.seconds + 1 && hid.n === 1, 'scheduler continues after hidden (pos ' + JSON.stringify(hid.p0) + ' -> ' + JSON.stringify(hid.p1) + ')');

console.log('unknown names warn once, do not throw');
const nlog = logs.length;
await ev(() => { for (let i = 0; i < 3; i++) { LC.audio.sfx('nope.x'); LC.audio.voice('nobody', 'light'); LC.audio.voice('claude', 'nope'); LC.audio.music('nope'); } });
const extra = logs.slice(nlog);
check(extra.length === 4, 'exactly 4 one-time warnings (' + extra.length + ')');
logs.length = nlog;

console.log('Web Audio unavailable');
const p2 = await browser.newPage();
const logs2 = [];
p2.on('pageerror', e => logs2.push(e.message));
await p2.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; delete window.OfflineAudioContext; });
await p2.goto(pathToFileURL(path.join(ROOT, 'dev/audio-render.html')).href);
await p2.waitForFunction(() => window.RENDER_READY === true);
const na = await p2.evaluate(() => {
  const A = LC.audio; try { A.unlock(); A.sfx('hit.heavy'); A.voice('claude', 'ko'); A.music('title'); A.duck(1, 1); A.setPaused(true); A.setVolume('master', 0.2); return A.state(); } catch (e) { return 'threw ' + e.message; }
});
check(na === 'unavailable' && !logs2.length, 'no Web Audio: silent, state ' + na);

check(logs.length === 0, 'no console errors/warnings during playback' + (logs.length ? ':\n    ' + [...new Set(logs)].join('\n    ') : ''));
await browser.close();
console.log(fails.length ? '\n' + fails.length + ' FAILED' : '\nALL OK');
process.exit(fails.length ? 1 : 0);
