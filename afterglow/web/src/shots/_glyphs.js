// textatlas smoke test: the question 「有人吗？」 made of ~600k tiny multilingual glyphs that breathe.
import { glyphAtlas, uniqueGlyphs, glyphPointsMaterial } from '../lib/textatlas.js';
import { VOICES, FONT_FOR } from '../data/voices.js';
export async function create(ctx) {
  const { THREE, util, kit, W, H } = ctx;
  const items = VOICES.filter(v => !['ar', 'fa', 'ur', 'hi', 'sa', 'th', 'bn', 'ta', 'te', 'ml', 'kn', 'pa', 'gu', 'si', 'my', 'lo', 'km', 'bo'].includes(v.lang)).map(v => ({ text: v.t, font: FONT_FOR(v.lang) }));
  const glyphs = uniqueGlyphs(items);
  const A = glyphAtlas(glyphs, { cell: 48 });
  const shape = util.textToPoints('有人吗？', { font: '300 420px "Noto Serif CJK SC"', step: 1.2, maxPoints: 600000, seed: 2 });
  const N = shape.count, r = util.rng(5);
  const pos = new Float32Array(N * 3), gi = new Float32Array(N), sd = new Float32Array(N), br = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[3 * i] = shape.points[2 * i] / 100; pos[3 * i + 1] = shape.points[2 * i + 1] / 100; pos[3 * i + 2] = (r() - 0.5) * 0.15; gi[i] = Math.floor(r() * A.count); sd[i] = r(); br[i] = 0.3 + 0.7 * Math.pow(r(), 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('glyph', new THREE.BufferAttribute(gi, 1));
  g.setAttribute('seed', new THREE.BufferAttribute(sd, 1)); g.setAttribute('bright', new THREE.BufferAttribute(br, 1));
  const mat = glyphPointsMaterial(A, { H, size: 30, color: [1.0, 0.85, 0.6], vertexBody: 'b *= 0.6 + 0.4 * sin(time * (1.0 + 2.0 * seed) + seed * 40.0);' });
  const scene = new THREE.Scene(); scene.add(new THREE.Points(g, mat));
  const cam = kit.filmCamera(W, H, { focalMM: 40 });
  return {
    render(shot, f) {
      mat.uniforms.time.value = f.t;
      const z = util.lerp(9, 2.2, util.ease.inOutCubic(f.p));
      cam.position.set(0.3, 0, z); cam.lookAt(0.3 * f.p, 0, 0);
      ctx.renderer.setRenderTarget(f.target); ctx.renderer.render(scene, cam);
    },
    post() { return { bloom: 0.6 }; },
  };
}
