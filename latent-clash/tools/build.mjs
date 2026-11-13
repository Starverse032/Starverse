// LATENT CLASH — single-file build (PLATFORM).
// node tools/build.mjs [--minify]  ->  dist/latent-clash.html
// Inlines index.html's CSS, src/shared/{config,lore}.js and every module's files (read from each
// src/<module>/manifest.js, evaluated in a vm with a fake window) in the canonical init order.
// One <script> per source file, so a module that throws at load time cannot take the others down.
// --minify uses terser or esbuild if installed (npm i -D terser); otherwise plain concatenation.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const ORDER = ['platform', 'audio', 'fx', 'stages', 'illust', 'rig', 'fight'];
const minify = process.argv.includes('--minify');
const require = createRequire(import.meta.url);

function readManifest(mod) {
  const file = path.join(SRC, mod, 'manifest.js');
  if (!fs.existsSync(file)) return null;
  const sandbox = { window: { LC_MANIFEST: {} } };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file, timeout: 1000 });
  const list = sandbox.window.LC_MANIFEST[mod];
  if (!Array.isArray(list)) throw new Error(`manifest ${mod} did not register a file list`);
  return list;
}

let minifier = null;
if (minify) {
  try { const t = require('terser'); minifier = async (code) => (await t.minify(code, { compress: true, mangle: true })).code; }
  catch { try { const e = require('esbuild'); minifier = async (code) => (await e.transform(code, { minify: true, loader: 'js' })).code; } catch { console.warn('no minifier installed (terser/esbuild): plain concatenation'); } }
}

const safe = (code) => code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const files = [path.join(SRC, 'shared', 'config.js'), path.join(SRC, 'shared', 'lore.js')];
const report = [];
for (const mod of ORDER) {
  const list = readManifest(mod);
  if (!list) { report.push(`${mod}: (absent)`); continue; }
  let bytes = 0;
  for (const f of list) {
    const p = path.normalize(path.join(SRC, mod, f));
    if (!fs.existsSync(p)) throw new Error(`${mod}/manifest.js lists missing file ${f}`);
    files.push(p); bytes += fs.statSync(p).size;
  }
  report.push(`${mod}: ${list.length} files, ${(bytes / 1024).toFixed(1)} KB`);
}

let scripts = '';
for (const p of files) {
  let code = fs.readFileSync(p, 'utf8');
  if (minifier) { try { code = await minifier(code); } catch (e) { console.warn('minify failed for', path.relative(ROOT, p), e.message); } }
  scripts += `<script data-file="${path.relative(SRC, p).replace(/\\/g, '/')}">\n${safe(code)}\n</script>\n`;
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const loaderTag = /<script[^>]*src="src\/shared\/loader\.js"[^>]*><\/script>\s*/;
if (!loaderTag.test(html)) throw new Error('index.html: loader <script> tag not found');
const out = html.replace(loaderTag, () => scripts);

// No external requests of any kind.
const ext = out.match(/<(?:script|link|img|iframe|audio|video|source|object|embed)\b[^>]*\s(?:src|href)\s*=\s*["'](?!data:|#)[^"']*["']|url\(\s*["']?(?:https?:)?\/\/|@import\s/gi);
if (ext) { console.error('external reference(s) found:', ext.slice(0, 5)); process.exit(1); }

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const target = path.join(ROOT, 'dist', 'latent-clash.html');
fs.writeFileSync(target, out);
console.log(report.join('\n'));
console.log(`dist/latent-clash.html: ${(out.length / 1024).toFixed(1)} KB (${Buffer.byteLength(out)} bytes, ${files.length} scripts${minifier ? ', minified' : ''})`);
