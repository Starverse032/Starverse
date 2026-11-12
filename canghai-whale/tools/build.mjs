// Bundles src/main.js (+ three.js, three-mesh-bvh and the campus data) into one self-contained index.html
import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: !process.argv.includes('--debug'),
  write: false,
  target: 'es2020',
  loader: { '.json': 'json' },
  legalComments: 'none',
  logLevel: 'warning',
};

function emit(result) {
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
  const html = tpl.replace('/*__BUNDLE__*/', () => js);
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log(`index.html  ${(html.length / 1024).toFixed(0)} KB`);
}

if (watch) {
  const ctx = await context({
    ...options,
    plugins: [{ name: 'emit', setup(b) { b.onEnd((r) => { if (!r.errors.length) emit(r); }); } }],
  });
  await ctx.watch();
} else {
  emit(await build(options));
}
