// Text atlases for particle typography: bake glyphs or whole phrases once into a texture,
// then draw hundreds of thousands of them as points / instanced quads.
//
//   const A = glyphAtlas([{ ch: '有', font: '"Noto Serif CJK SC"' }, ...], { cell: 64 });
//   // per point: attribute float glyph (index into A); material: glyphPointsMaterial(A)
//
//   const P = phraseAtlas(VOICES.map(v => ({ text: v.t, font: FONT_FOR(v.lang), rtl: RTL.has(v.lang) })));
//   // P.rects[i] = [u0, v0, u1, v1, aspect]  → use as instanced attributes on a quad
import * as THREE from 'three';
import * as GLSL from './glsl.js';

function texFrom(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = false; // we address rows top-down in the shader
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4;
  return t;
}

// Unique glyph list → square grid atlas. Each cell is `cell` px; glyph drawn white, centred, alpha = coverage.
export function glyphAtlas(glyphs, { cell = 64, fill = 0.78, weight = 400 } = {}) {
  const cols = Math.ceil(Math.sqrt(glyphs.length));
  const size = cols * cell;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  glyphs.forEach((gl, i) => {
    const x = (i % cols) * cell + cell / 2, y = Math.floor(i / cols) * cell + cell / 2;
    g.font = `${gl.weight || weight} ${Math.round(cell * fill)}px ${gl.font}`;
    g.fillText(gl.ch, x, y + cell * 0.04);
  });
  return { texture: texFrom(c), cols, cell, count: glyphs.length, canvas: c, glyphs };
}

// Split strings into unique glyphs (grapheme-ish: code points; complex scripts are better as phrases).
export function uniqueGlyphs(items) {
  const seen = new Map();
  for (const { text, font } of items) for (const ch of Array.from(text)) {
    if (/\s/.test(ch)) continue;
    const k = font + '|' + ch;
    if (!seen.has(k)) seen.set(k, { ch, font });
  }
  return [...seen.values()];
}

// Whole phrases (correct shaping for Arabic, Devanagari, Thai…) packed into rows of a big atlas.
export function phraseAtlas(items, { height = 72, size = 4096, pad = 10, weight = 400 } = {}) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textBaseline = 'middle';
  let x = pad, y = pad;
  const rects = [];
  for (const it of items) {
    g.font = `${it.weight || weight} ${Math.round(height * 0.62)}px ${it.font}`;
    g.direction = it.rtl ? 'rtl' : 'ltr';
    const w = Math.min(size - 2 * pad, Math.ceil(g.measureText(it.text).width) + 8);
    if (x + w + pad > size) { x = pad; y += height + pad; }
    if (y + height + pad > size) { console.warn('phraseAtlas full'); break; }
    g.textAlign = it.rtl ? 'right' : 'left';
    g.fillText(it.text, it.rtl ? x + w - 4 : x + 4, y + height / 2);
    rects.push([x / size, y / size, (x + w) / size, (y + height) / size, w / height]);
    x += w + pad;
  }
  return { texture: texFrom(c), rects, height, size, canvas: c };
}

// Points that each draw one glyph from a glyphAtlas. Attributes expected on the geometry:
//   position (vec3), glyph (float index), and optionally seed (float), bright (float).
// Uniforms: size (px at 1080p for a point at distance 1 → scaled by 1/depth), opacity, time, color.
export function glyphPointsMaterial(atlas, { H = 1080, size = 24, color = [1, 1, 1], additive = true, vertexBody = '', fragmentBody = '' } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { atlas: { value: atlas.texture }, cols: { value: atlas.cols }, size: { value: size }, H: { value: H }, opacity: { value: 1 }, time: { value: 0 }, color: { value: new THREE.Vector3(...color) } },
    vertexShader: GLSL.common + GLSL.noise + /* glsl */ `
      attribute float glyph; attribute float seed; attribute float bright;
      uniform float size, H, time; varying float vGlyph; varying float vB; varying float vSeed;
      void main(){
        vec3 p = position;
        float b = bright;
        ${vertexBody}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float sz = size * (H / 1080.0) / max(-mv.z, 1e-3);
        // keep sub-pixel glyphs as 1.5px motes with energy-conserving brightness
        b *= min(1.0, (sz / 1.5) * (sz / 1.5));
        gl_PointSize = clamp(sz, 1.5, 256.0);
        vGlyph = glyph; vB = b; vSeed = seed;
      }`,
    fragmentShader: GLSL.common + /* glsl */ `
      uniform sampler2D atlas; uniform float cols, opacity, time; uniform vec3 color; varying float vGlyph; varying float vB; varying float vSeed;
      void main(){
        vec2 cell = vec2(mod(vGlyph, cols), floor(vGlyph / cols));
        vec2 uv = (cell + gl_PointCoord) / cols;
        float a = texture2D(atlas, uv).a;
        vec3 col = color * vB;
        ${fragmentBody}
        gl_FragColor = vec4(col * a * opacity, a * opacity);
      }`,
  });
}
