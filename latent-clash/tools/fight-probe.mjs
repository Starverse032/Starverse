#!/usr/bin/env node
/* LATENT CLASH — FIGHT probe: dumps rig metrics (charInfo, anchors per anim segment, bounds) and
 * fx spriteInfo for the sprites FIGHT uses, from the real modules. Used for the V2 retune.
 *   node tools/fight-probe.mjs [--chars=gemini] [--anims=5L,2H] [--anchors=weapon,muzzle] [--n=4] [--fx=gemini.meteor,gemini.star] */
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v == null ? true : v]; }));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto('file://' + root + '/dev/fight-sandbox.html?manual=1');
await page.waitForFunction(() => window.FS && FS.ready, null, { timeout: 60000 });
const out = await page.evaluate((a) => {
  const R = LC.rig, o = { chars: {}, fx: {} };
  const anims = a.anims ? a.anims.split(',') : null;
  const anchors = (a.anchors || 'weapon,muzzle,chest,top,grab').split(',');
  const n = +(a.n || 4);
  for (const ch of (a.chars ? a.chars.split(',') : ['claude', 'deepseek'])) {
    const c = o.chars[ch] = { info: R.charInfo(ch), anims: {} };
    const p = R.createPuppet(ch, { palette: 0 });
    for (const an of R.listAnims(ch)) {
      if (anims && anims.indexOf(an) < 0) continue;
      const ai = R.animInfo(ch, an), segs = {};
      for (const s of ai.segs) {
        const rows = [];
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n;
          p.setPoseSeg(an, s.id, u);
          const r = { u: +u.toFixed(2) };
          for (const nm of anchors) { const v = p.getAnchor(nm); r[nm] = v ? [Math.round(v.x), Math.round(v.y)] : null; }
          const b = p.getBounds(); r.b = [b.x, b.y, b.w, b.h].map(Math.round);
          rows.push(r);
        }
        segs[s.id + '/' + s.f] = rows;
      }
      c.anims[an] = segs;
    }
  }
  for (const s of (a.fx ? a.fx.split(',') : ['claude.beam', 'claude.guardrail', 'claude.spark', 'claude.book', 'deepseek.wave', 'deepseek.whale', 'deepseek.tidal', 'deepseek.pool', 'screen.superBackdrop', 'screen.impact'])) {
    try { const i = LC.fx.spriteInfo(s); o.fx[s] = i && i.frames ? Object.assign({}, i, { frames: i.frames.map((f, t) => t + ':' + (f && f.w ? [f.x, f.y, f.w, f.h].join(',') : '-')).join(' ') }) : i; } catch (e) { o.fx[s] = 'ERR ' + e; }
  }
  return o;
}, args);
console.log(JSON.stringify(out, (k, v) => Array.isArray(v) && v.length <= 4 && typeof v[0] === 'number' ? '[' + v.join(',') + ']' : v, 1).replace(/"\[([-\d,]+)\]"/g, '[$1]'));
await browser.close();
