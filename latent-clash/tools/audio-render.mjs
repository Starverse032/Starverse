#!/usr/bin/env node
/* LATENT CLASH — offline audio renderer / analyser (AUDIO module tooling).
 *
 * Renders SFX, voices and music through the real LC.audio graph on an OfflineAudioContext inside
 * headless Chromium (Playwright), prints measurements and writes waveform+spectrogram PNGs (and
 * optionally WAVs) to .shots/audio/.
 *
 *   node tools/audio-render.mjs sfx [name ...|all]        each SFX alone
 *   node tools/audio-render.mjs voice [char:kind ...|all]
 *   node tools/audio-render.mjs music [name ...|all] [--seconds N]   (default: intro + one loop, max 100 s)
 *   node tools/audio-render.mjs seam [name ...|all]       render intro + 2 loop passes, compare the seams
 *   node tools/audio-render.mjs theory [name ...|all]     compile + validate + print the score per bar
 *   node tools/audio-render.mjs combat                    combat simulation: stage music + realistic SFX burst
 *   node tools/audio-render.mjs all                       sfx + voice + music + seam + theory summary
 * Flags: --wav (also write WAVs)  --no-png  --game (use default game volumes instead of unity)
 *        --score (theory: print full score, not just issues)  --out DIR
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--') && !a.includes('=')));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--seconds', '--out'].includes(args[i - 1])));
const cmd = pos[0] || 'all';
const names = pos.slice(1);
const OUT = path.resolve(ROOT, opt('out', '.shots/audio'));
const PNG = !flags.has('--no-png'), WAV = flags.has('--wav');
const VOL = flags.has('--game') ? { master: 0.8, music: 0.6, sfx: 0.9 } : { master: 1, music: 1, sfx: 1 };
fs.mkdirSync(OUT, { recursive: true });

const f1 = (x, d = 1) => (x === -Infinity || x == null || Number.isNaN(x)) ? '  -inf' : x.toFixed(d);
const pad = (s, n) => String(s).padStart(n);
const padr = (s, n) => String(s).padEnd(n);

function save(base, res) {
  const safe = base.replace(/[^a-z0-9._-]/gi, '_');
  if (res.png) fs.writeFileSync(path.join(OUT, safe + '.png'), Buffer.from(res.png.split(',')[1], 'base64'));
  if (res.wav) fs.writeFileSync(path.join(OUT, safe + '.wav'), Buffer.from(res.wav, 'base64'));
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(path.join(ROOT, 'dev/audio-render.html')).href);
await page.waitForFunction(() => window.RENDER_READY === true);

async function run(job) {
  return page.evaluate(async ({ job, PNG, WAV, VOL }) => {
    const A = LC.audio, K = A._;
    let spec, title, from = 0, to = 0, marks = [];
    if (job.type === 'sfx') {
      const d = K.SFX[job.name];
      spec = { seconds: d.dur + d.tail + 0.35, sfx: [{ name: job.name, at: 0.05, opts: job.opts }] };
      title = 'sfx ' + job.name; from = 0.04;
    } else if (job.type === 'voice') {
      spec = { seconds: 1.4, voice: [{ char: job.char, kind: job.kind, at: 0.05 }] };
      title = 'voice ' + job.char + ':' + job.kind; from = 0.04;
    } else if (job.type === 'music') {
      const s = K.compile(job.name, true);
      const secs = job.seconds || Math.min(100, s.loopStart >= 0 ? (s.loopStart * s.stepDur + s.loopDur + 3) : s.duration + 2.5);
      spec = { seconds: secs, music: job.name };
      title = 'music ' + job.name + '  ' + secs.toFixed(1) + ' s';
      if (s.loopStart >= 0) marks = [0.04 + s.loopStart * s.stepDur, 0.04 + s.total * s.stepDur];
    } else if (job.type === 'seam') {
      const s = K.compile(job.name, true);
      spec = { seconds: s.loopStart * s.stepDur + 2 * s.loopDur + 2.5, music: job.name };
      title = 'seam ' + job.name;
    } else if (job.type === 'mix') {
      spec = job.spec; title = job.title;
    }
    spec.vol = VOL;
    const { buffer, info } = await A._dev.render(spec);
    const res = { name: job.label || job.name, stats: LCA.stats(buffer, from, to || undefined), errors: K.SONGS[job.name] ? K.SONGS[job.name].errors : [] };
    if (job.type === 'seam' && info.song && info.song.loopStart >= 0) {
      const sd = info.song.stepDur, seam1 = info.t0 + info.song.total * sd, seam2 = seam1 + info.song.loopDur;
      res.seam = {
        seam1, seam2, loopDur: info.song.loopDur,
        cmp: LCA.compare(buffer, seam1 - 1.5, seam2 - 1.5, 3), env: LCA.compareEnv(buffer, seam1 - 1.5, seam2 - 1.5, 3),
        win1: LCA.windows(buffer, seam1, 0.25, 0.05), win2: LCA.windows(buffer, seam2, 0.25, 0.05)
      };
      marks = [seam1, seam2];
      // stats of one full loop pass
      res.stats = LCA.stats(buffer, seam1, seam2);
    }
    if (PNG) res.png = LCA.png(buffer, title, { marks });
    if (WAV) res.wav = LCA.wav(buffer);
    return res;
  }, { job, PNG, WAV, VOL });
}

function header() {
  console.log(padr('name', 22) + pad('peak', 7) + pad('rms', 7) + pad('LUFS-M', 8) + pad('LUFS-I', 8) + pad('dur ms', 8) + pad('att ms', 8) + pad('cent Hz', 9) + '  bands% <120/<500/<2k/<5k/>5k' + pad('clip', 6) + pad('dc', 9));
}
function row(r) {
  const s = r.stats;
  console.log(padr(r.name, 22) + pad(f1(s.peakDb), 7) + pad(f1(s.rmsDb), 7) + pad(f1(s.lufsM), 8) + pad(f1(s.lufsI), 8) + pad(Math.round(s.durMs), 8) +
    pad(f1(s.attackMs), 8) + pad(Math.round(s.centroid), 9) + '  ' + padr(s.bands.map(b => b.toFixed(0)).join('/'), 28) + pad(s.clips, 6) + pad(s.dc.toExponential(1), 9));
}

const all = await page.evaluate(() => ({ sfx: LC.audio.list().sfx, music: LC.audio.list().music, voice: LC.audio.list().voice }));
const results = [];

async function doSfx(list) {
  list = list.length && list[0] !== 'all' ? list : all.sfx;
  console.log('\n## SFX (' + (flags.has('--game') ? 'game volumes' : 'unity gain') + ')'); header();
  for (const n of list) {
    const parts = n.split('@'); const opts = parts[1] ? { pitch: +parts[1] } : undefined;
    const r = await run({ type: 'sfx', name: parts[0], opts, label: n }); row(r); save('sfx_' + n, r); results.push(r);
  }
}
async function doVoice(list) {
  let jobs = [];
  if (!list.length || list[0] === 'all') all.voice.chars.forEach(c => all.voice.kinds.forEach(k => jobs.push(c + ':' + k)));
  else jobs = list;
  console.log('\n## VOICES'); header();
  for (const j of jobs) {
    const [c, k] = j.split(':'); const r = await run({ type: 'voice', char: c, kind: k, label: j }); row(r); save('voice_' + c + '_' + k, r); results.push(r);
  }
}
async function doMusic(list) {
  list = list.length && list[0] !== 'all' ? list : all.music;
  console.log('\n## MUSIC'); header();
  for (const n of list) {
    const r = await run({ type: 'music', name: n, seconds: opt('seconds') ? +opt('seconds') : 0 }); row(r); save('music_' + n, r); results.push(r);
    if (r.errors && r.errors.length) console.log('   ERRORS: ' + r.errors.join('\n           '));
  }
}
async function doSeam(list) {
  const loops = await page.evaluate(() => LC.audio.list().music.filter(n => { const s = LC.audio._.compile(n); return s && s.loopStart >= 0; }));
  list = list.length && list[0] !== 'all' ? list : loops;
  console.log('\n## LOOP SEAMS (signal around seam 1 vs seam 2; stats over one loop pass)');
  header();
  for (const n of list) {
    const r = await run({ type: 'seam', name: n }); row(r); save('seam_' + n, r); results.push(r);
    if (r.seam) {
      const s = r.seam;
      const jump = (w) => Math.max(...w.slice(1).map((v, i) => Math.abs(v - w[i])));
      console.log(`   loop ${s.loopDur.toFixed(2)} s; seam envelope diff ${f1(s.env.diffDb)} dB, waveform diff ${f1(s.cmp.diffDb)} dB re signal (${f1(s.cmp.rmsDb)} dB rms); max 50ms-window jump at seam1 ${f1(jump(s.win1))} dB, seam2 ${f1(jump(s.win2))} dB`);
      console.log('   windows@seam1: ' + s.win1.join(' '));
    }
  }
}
async function doTheory(list) {
  list = list.length && list[0] !== 'all' ? list : all.music;
  let nerr = 0;
  for (const n of list) {
    const a = await page.evaluate((n) => { const r = LC.audio._dev.analyze(n); return { lines: r.lines, issues: r.issues, errors: r.errors }; }, n);
    console.log('\n' + (flags.has('--score') ? a.lines.join('\n') : a.lines[0]));
    a.errors.forEach(e => console.log('  ERROR ' + e));
    const warns = a.issues.filter(i => i.startsWith('WARN'));
    const infos = a.issues.filter(i => i.startsWith('info'));
    warns.forEach(i => console.log('  ' + i));
    if (flags.has('--score')) infos.forEach(i => console.log('  ' + i));
    console.log(`  -> ${a.errors.length} errors, ${warns.length} warnings, ${infos.length} info`);
    nerr += a.errors.length;
  }
  if (nerr) process.exitCode = 1;
}
async function doCombat() {
  const spec = await page.evaluate(() => {
    const r = LC.audio._.rng(5), ev = [], vo = [];
    let t = 1.0;
    const hits = ['hit.light', 'hit.medium', 'hit.heavy'];
    while (t < 11) {
      const kind = r();
      const pan = (r() * 2 - 1) * 0.5;
      if (kind < 0.45) {         // a combo: L M H special
        ['whiff.light', 'hit.light', 'whiff.medium', 'hit.medium', 'whiff.heavy', 'hit.heavy'].forEach((n, i) => ev.push({ name: n, at: t + Math.floor(i / 2) * 0.22 + (i % 2) * 0.07, opts: { pan } }));
        ev.push({ name: r() < 0.5 ? 'claude.haiku' : 'deepseek.chain', at: t + 0.75, opts: { pan } });
        ev.push({ name: 'hit.special', at: t + 0.8, opts: { pan } });
        vo.push({ char: r() < 0.5 ? 'claude' : 'deepseek', kind: 'special', at: t + 0.7 });
        t += 1.4;
      } else if (kind < 0.7) {   // blocked string
        ev.push({ name: 'block.light', at: t, opts: { pan } }, { name: 'block.light', at: t + 0.2, opts: { pan } }, { name: 'block.heavy', at: t + 0.45, opts: { pan } });
        t += 0.8;
      } else if (kind < 0.85) {  // jump-in
        ev.push({ name: 'jump', at: t, opts: { pan } }, { name: 'whiff.heavy', at: t + 0.35, opts: { pan } }, { name: 'hit.counter', at: t + 0.42, opts: { pan } }, { name: 'land', at: t + 0.6, opts: { pan } });
        vo.push({ char: 'deepseek', kind: 'hurt', at: t + 0.45 });
        t += 1.0;
      } else {
        ev.push({ name: 'dash', at: t, opts: { pan } }, { name: 'throw.grab', at: t + 0.3, opts: { pan } }, { name: 'throw.slam', at: t + 0.8, opts: { pan } });
        t += 1.2;
      }
    }
    ev.push({ name: 'super.flash', at: 11.5 }, { name: 'claude.beam', at: 12.3 }, { name: 'ko', at: 13.6 });
    vo.push({ char: 'claude', kind: 'super', at: 11.5 }, { char: 'deepseek', kind: 'ko', at: 13.7 });
    return { seconds: 16, music: 'stage.abyss', sfx: ev.filter(e => LC.audio._.SFX[e.name]), voice: vo, duck: [{ at: 11.5, amount: 0.6, secs: 1.6 }, { at: 13.6, amount: 0.7, secs: 2 }] };
  });
  const r = await run({ type: 'mix', spec, title: 'combat simulation over stage.abyss', label: 'combat' });
  console.log('\n## COMBAT SIMULATION'); header(); row(r); save('combat', r);
  const r2 = await run({ type: 'mix', spec: { ...spec, sfx: [], voice: [], duck: [] }, title: 'music only (same span)', label: 'combat-music-only' });
  row(r2); save('combat_music_only', r2);
}

try {
  if (cmd === 'sfx') await doSfx(names);
  else if (cmd === 'voice') await doVoice(names);
  else if (cmd === 'music') await doMusic(names);
  else if (cmd === 'seam') await doSeam(names);
  else if (cmd === 'theory') await doTheory(names);
  else if (cmd === 'combat') await doCombat();
  else if (cmd === 'all') { await doSfx([]); await doVoice([]); await doMusic([]); await doSeam([]); await doTheory([]); await doCombat(); }
  else console.log('unknown command ' + cmd);
} finally {
  const clip = results.filter(r => r.stats.clips > 0);
  if (clip.length) console.log('\nCLIPPING in: ' + clip.map(r => r.name).join(', '));
  if (errors.length) { console.log('\nconsole errors/warnings:'); [...new Set(errors)].slice(0, 40).forEach(e => console.log('  ' + e)); }
  console.log('\noutput: ' + path.relative(ROOT, OUT));
  await browser.close();
}
