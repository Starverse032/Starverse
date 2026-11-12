import * as THREE from 'three';
import { makeNoiseTexture } from './util.js';

/** Uniforms shared by every procedural material. */
export const G = {
  uNoise: { value: null },
  uTime: { value: 0 },
  uNight: { value: 0 },      // 0 = day, 1 = deep night
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
  uWind: { value: 1 },
};

let csmRef = null;
const allMats = new Set();

export function initMaterials(csm) {
  csmRef = csm;
  G.uNoise.value = makeNoiseTexture(256);
}

const COMMON_GLSL = /* glsl */ `
uniform sampler2D uNoise;
uniform float uTime;
uniform float uNight;
uniform vec3 uSunDir;
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float boxm(vec2 p, vec2 lo, vec2 hi, vec2 w){
  vec2 a = smoothstep(lo - w, lo + w, p) * (1.0 - smoothstep(hi - w, hi + w, p));
  return a.x * a.y;
}
`;

/**
 * Extend a MeshStandard/Physical material with custom GLSL while keeping all of three's lighting,
 * shadows (CSM) and fog.
 */
export function patch(mat, o = {}) {
  if (csmRef && o.csm !== false) csmRef.setupMaterial(mat);
  const prev = mat.onBeforeCompile;
  const uniforms = Object.assign({}, G, o.uniforms || {});
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nuniform float uTime;\n${o.vpars || ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${o.vbegin || ''}`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        {
          vec4 wp_ = vec4( transformed, 1.0 );
          vec3 wn_ = objectNormal;
          #ifdef USE_INSTANCING
            wp_ = instanceMatrix * wp_;
            wn_ = mat3( instanceMatrix ) * wn_;
          #endif
          wp_ = modelMatrix * wp_;
          vWPos = wp_.xyz;
          vWNrm = normalize( mat3( modelMatrix ) * wn_ );
        }
        ${o.vmain || ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\n${COMMON_GLSL}\n${o.fpars || ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${o.fdiffuse || ''}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${o.frough || ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${o.fnormal || ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${o.femissive || ''}`);
    if (o.debug) console.log(shader.fragmentShader);
  };
  const key = o.key || 'patched';
  mat.customProgramCacheKey = () => key + (csmRef ? '_csm' : '');
  allMats.add(mat);
  return mat;
}

/** plain standard material that still receives cascaded shadows */
export function std(params) {
  const m = new THREE.MeshStandardMaterial(params);
  if (csmRef) csmRef.setupMaterial(m);
  allMats.add(m);
  return m;
}

// bump mapping from a procedural height value (screen-space derivatives)
const BUMP_GLSL = /* glsl */ `
vec3 bumpNormal(vec3 n, float h, float strength){
  vec3 dpdx = dFdx(-vViewPosition);
  vec3 dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(h) * strength;
  float dhy = dFdy(h) * strength;
  vec3 r1 = cross(dpdy, n);
  vec3 r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  vec3 r = abs(det) * n - g;
  float l2 = dot(r, r);
  return (l2 > 1e-24 && l2 < 1e24) ? r * inversesqrt(l2) : n;
}
`;

// ============================================================================ building facades
export const STYLE = { ribbon: 0, punched: 1, curtain: 2, fins: 3, holes: 4, grid: 5, blank: 6, canteen: 7, dorm: 8 };

export function facadeMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, envMapIntensity: 1.25 });
  return patch(mat, {
    key: 'facade',
    vpars: /* glsl */ `
      attribute vec4 aB; attribute vec4 aC;
      varying vec4 vB; varying vec4 vC; varying vec2 vFUv;`,
    vmain: /* glsl */ `vB = aB; vC = aC; vFUv = uv;`,
    fpars: /* glsl */ `
      varying vec4 vB; varying vec4 vC; varying vec2 vFUv;`,
    fdiffuse: /* glsl */ `
      float fcGlass = 0.0; float fcMetal = 0.0; float fcFrame = 0.0; vec3 fcEmis = vec3(0.0);
      {
        float fH = vB.x; float bW = vB.y; float sty = floor(vB.z + 0.5); float seed = vB.w;
        vec2 cellc = vec2(vFUv.x / bW, vFUv.y / fH);
        vec2 cid = floor(cellc);
        vec2 cf = cellc - cid;
        vec2 fw = fwidth(cellc) * 0.75 + 1e-4;
        float inBody = 1.0 - smoothstep(vC.x - 0.05, vC.x + 0.05, vFUv.y);
        float gnd = 1.0 - step(0.5, cid.y);
        float glass = 0.0, frame = 0.0, spandrel = 0.0, shade = 1.0, gMetal = 0.22, roomD = 1.4;
        vec3 wall = diffuseColor.rgb;
        if (sty < 0.5) {            // ---- ribbon windows with piers (teaching buildings)
          glass = boxm(cf, vec2(0.03, 0.36), vec2(0.97, 0.86), fw);
          float pier = step(mod(cid.x, 3.0), 0.5);
          glass *= 1.0 - pier * (1.0 - smoothstep(0.22 - fw.x, 0.22 + fw.x, cf.x));
          shade = 1.0 - 0.2 * boxm(cf, vec2(-1.0, 0.86), vec2(2.0, 0.94), fw);
          shade *= 1.0 - 0.07 * boxm(cf, vec2(-1.0, 0.0), vec2(2.0, 0.05), fw);
          if (gnd > 0.5) { glass = boxm(cf, vec2(0.12, 0.0), vec2(0.88, 0.82), fw); gMetal = 0.1; }
        } else if (sty < 1.5) {     // ---- punched windows
          glass = boxm(cf, vec2(0.25, 0.32), vec2(0.75, 0.8), fw);
          shade = 1.0 - 0.16 * boxm(cf, vec2(0.21, 0.25), vec2(0.79, 0.32), fw);
          if (gnd > 0.5) glass = boxm(cf, vec2(0.14, 0.0), vec2(0.86, 0.78), fw);
        } else if (sty < 2.5) {     // ---- glass curtain wall
          float pane = boxm(cf, vec2(0.028, 0.035), vec2(0.972, 1.01), fw);
          frame = 1.0 - pane; glass = 1.0;
          spandrel = 1.0 - smoothstep(0.22 - fw.y, 0.22 + fw.y, cf.y);
          gMetal = 0.86;
          if (gnd > 0.5) { spandrel = 0.0; gMetal = 0.35; }
        } else if (sty < 3.5) {     // ---- vertical fins / louvres over ribbon glazing
          float sub = fract(cellc.x * 3.0);
          float fwx = fw.x * 3.0;
          float fin = 1.0 - smoothstep(0.24 - fwx, 0.24 + fwx, sub);
          glass = boxm(cf, vec2(-1.0, 0.3), vec2(2.0, 0.9), fw) * (1.0 - fin);
          shade = 1.0 - 0.28 * (1.0 - fin) * boxm(cf, vec2(-1.0, 0.9), vec2(2.0, 0.985), fw);
          wall *= mix(1.0, 0.84 + 0.16 * smoothstep(0.0, 0.24, sub), fin);
          if (gnd > 0.5) { glass = boxm(cf, vec2(0.1, 0.0), vec2(0.9, 0.84), fw); gMetal = 0.1; }
        } else if (sty < 4.5) {     // ---- "the building of holes": white walls, random square openings
          float r1 = hash21(cid + seed * 97.0);
          float r2 = hash21(cid * 1.7 + seed * 31.0 + 5.0);
          float sz = r1 < 0.16 ? 0.0 : (r1 < 0.48 ? 0.16 : (r1 < 0.8 ? 0.26 : 0.37));
          vec2 hs = vec2(sz * fH / bW, sz);
          vec2 ctr = vec2(0.5) + (vec2(r2, fract(r2 * 7.31)) - 0.5) * max(vec2(0.0), vec2(0.86) - 2.0 * hs);
          glass = sz > 0.0 ? boxm(cf, ctr - hs, ctr + hs, fw) : 0.0;
          vec2 q = (cf - (ctr - hs)) / max(hs * 2.0, vec2(1e-3));
          shade = 1.0;
          roomD = 2.2; gMetal = 0.08;
          // deep reveal: the top and one side of every opening sit in shadow
          float rev = glass * max(smoothstep(0.72, 1.0, q.y), smoothstep(0.8, 1.0, q.x) * 0.7);
          wall *= 1.0;
          frame = 0.0;
          spandrel = 0.0;
          fcFrame = rev;
          if (gnd > 0.5) glass = max(glass, boxm(cf, vec2(0.2, 0.0), vec2(0.8, 0.7), fw) * step(0.5, r2));
        } else if (sty < 5.5) {     // ---- stone / aluminium grid with glass infill
          glass = boxm(cf, vec2(0.11, 0.2), vec2(0.89, 0.93), fw);
          gMetal = 0.5;
          shade = 1.0 - 0.1 * boxm(cf, vec2(-1.0, 0.93), vec2(2.0, 1.0), fw);
          if (gnd > 0.5) { glass = boxm(cf, vec2(0.08, 0.0), vec2(0.92, 0.86), fw); gMetal = 0.2; }
        } else if (sty < 6.5) {     // ---- mostly blank walls with a few slot windows
          float r = hash21(vec2(cid.y * 3.1 + 1.0, seed * 51.0));
          glass = step(0.5, r) * boxm(cf, vec2(0.06, 0.52), vec2(0.94, 0.8), fw);
          if (gnd > 0.5) glass = boxm(cf, vec2(0.3, 0.0), vec2(0.7, 0.7), fw) * step(0.6, hash21(cid + seed));
        } else if (sty < 7.5) {     // ---- canteen: tall glazing between columns
          glass = boxm(cf, vec2(0.05, 0.06), vec2(0.95, 0.9), fw);
          frame = glass * (1.0 - boxm(fract(cf * vec2(3.0, 2.0)), vec2(0.03), vec2(0.97), fw * vec2(3.0, 2.0)));
          gMetal = 0.3;
        } else {                    // ---- dormitory: window + balcony band in every bay
          glass = boxm(cf, vec2(0.2, 0.33), vec2(0.8, 0.85), fw);
          float rail = boxm(cf, vec2(0.1, 0.03), vec2(0.9, 0.3), fw);
          float bars = rail * step(0.5, fract(cellc.x * 14.0));
          wall = mix(wall, wall * 0.74, bars * (1.0 - smoothstep(0.02, 0.08, fw.x)));
          shade = 1.0 - 0.3 * boxm(cf, vec2(0.1, 0.87), vec2(0.9, 0.98), fw);
          float dry = step(0.62, hash21(cid + seed * 13.0)) * boxm(cf, vec2(0.3, 0.12), vec2(0.7, 0.3), fw);
          wall = mix(wall, vec3(0.75, 0.3, 0.25) * (0.6 + 0.8 * hash21(cid * 3.3)), dry * 0.55 * (1.0 - smoothstep(0.02, 0.1, fw.x)));
          if (gnd > 0.5) glass = boxm(cf, vec2(0.12, 0.0), vec2(0.88, 0.8), fw);
        }
        glass *= inBody; frame *= inBody; spandrel *= inBody;

        // ---- interior mapping: a fake room behind every pane
        vec3 icol = vec3(0.2);
        float litOn = 0.0; vec3 lcol = vec3(1.0);
        float blind = 0.0;
        if (glass > 0.003) {
          vec3 Vw = normalize(vWPos - cameraPosition);
          vec3 Nw = normalize(vWNrm);
          vec3 Tw = normalize(vec3(-Nw.z, 0.0, Nw.x) + 1e-5);
          vec3 rd = vec3(dot(Vw, Tw) / bW, Vw.y / fH, max(2e-3, -dot(Vw, Nw)) / (bW * roomD));
          rd.xy += vec2(1e-5);
          vec3 ro = vec3(cf, 0.0);
          vec3 tm = (step(vec3(0.0), rd) - ro) / rd;
          float t = min(min(tm.x, tm.y), tm.z);
          vec3 hp = ro + rd * t;
          vec2 rid = cid + vec2(seed * 131.0, seed * 17.0);
          float rh = hash21(rid);
          float rh2 = hash21(rid + 3.7);
          vec3 wt = mix(vec3(0.78, 0.74, 0.66), vec3(0.62, 0.68, 0.74), rh);
          if (t > tm.z - 1e-4) {
            icol = wt * 0.82;
            icol *= mix(0.42, 1.0, smoothstep(0.26, 0.4, hp.y + 0.07 * sin(hp.x * 13.0 + rh * 40.0)));
            icol = mix(icol, vec3(0.92), 0.6 * boxm(hp.xy, vec2(0.15 + 0.4 * rh2, 0.46), vec2(0.5 + 0.4 * rh2, 0.8), vec2(0.01)));
          } else if (t > tm.y - 1e-4) {
            icol = rd.y > 0.0 ? vec3(0.86) * (0.55 + 0.45 * step(0.55, fract(hp.z * 2.5 + 0.2))) : vec3(0.33, 0.3, 0.27);
          } else {
            icol = wt * 0.62;
          }
          icol *= 1.0 - 0.5 * hp.z;
          blind = step(0.7, rh2) * step(mix(0.35, 0.8, fract(rh2 * 13.0)), cf.y) * (1.0 - spandrel);
          icol = mix(icol, vec3(0.8, 0.78, 0.72), blind * 0.85);
          float rT = 0.12 + 0.6 * hash21(rid + 9.1);
          litOn = step(hash21(rid + 5.3), vC.z) * smoothstep(rT, rT + 0.12, uNight);
          float tc = hash21(rid + 1.9);
          lcol = tc < 0.45 ? vec3(1.0, 0.78, 0.5) : (tc < 0.8 ? vec3(1.0, 0.93, 0.8) : vec3(0.8, 0.9, 1.0));
        }
        float gt = vC.y;
        vec3 gtint = gt < 0.5 ? vec3(0.62, 0.78, 0.92) : (gt < 1.5 ? vec3(0.55, 0.78, 0.74) : (gt < 2.5 ? vec3(0.72, 0.76, 0.82) : vec3(0.86, 0.74, 0.54)));
        vec3 galb = mix(icol * 0.2 * mix(vec3(1.0), gtint * 1.4, 0.5), gtint, gMetal * (1.0 - blind * 0.6));
        galb = mix(galb, gtint * 0.55, spandrel);
        galb *= 1.0 - 0.75 * fcFrame;

        // ---- wall weathering
        vec4 nz = texture2D(uNoise, vec2(vFUv.x * 0.11, vFUv.y * 0.021) + seed * 7.0);
        vec4 nz2 = texture2D(uNoise, vFUv * 0.37 + seed * 3.0);
        wall *= 0.9 + 0.2 * nz.r;
        wall *= 0.95 + 0.1 * nz2.g;
        wall *= mix(0.74, 1.0, smoothstep(0.0, 1.8, vFUv.y));
        wall *= mix(1.0, 0.9, smoothstep(vC.x - 0.3, vC.x, vFUv.y) * (1.0 - smoothstep(vC.x, vC.x + 0.12, vFUv.y)));
        wall *= shade;
        vec3 alb = mix(wall, vec3(0.15, 0.16, 0.18), frame);
        alb = mix(alb, galb, glass * (1.0 - frame));
        diffuseColor.rgb = alb;
        fcGlass = glass * (1.0 - frame) * (1.0 - blind * 0.7);
        fcMetal = glass * (1.0 - frame) * gMetal * (1.0 - blind) + frame * 0.6;
        fcFrame = frame;
        fcEmis = glass * (1.0 - frame) * (1.0 - spandrel) * litOn * lcol * (icol * 1.5 + 0.1) * 1.35;
      }`,
    frough: /* glsl */ `
      roughnessFactor = mix(roughnessFactor, 0.06, fcGlass);
      roughnessFactor = mix(roughnessFactor, 0.42, fcFrame);
      metalnessFactor = fcMetal;`,
    femissive: /* glsl */ `totalEmissiveRadiance += fcEmis;`,
  });
}

// ============================================================================ roofs / generic concrete
export function roofMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  return patch(mat, {
    key: 'roof',
    fpars: BUMP_GLSL,
    fdiffuse: /* glsl */ `
      float rfH = 0.0;
      {
        vec4 nz = texture2D(uNoise, vWPos.xz * 0.043);
        vec4 nz2 = texture2D(uNoise, vWPos.xz * 0.61 + vWPos.y * 0.37);
        diffuseColor.rgb *= 0.8 + 0.34 * nz.r;
        diffuseColor.rgb *= 0.92 + 0.16 * nz2.g;
        float up = step(0.6, vWNrm.y);
        vec2 tg = abs(fract(vWPos.xz / 2.4) - 0.5);
        float joint = smoothstep(0.5 - 0.012 - fwidth(vWPos.x) * 0.4, 0.5, max(tg.x, tg.y));
        diffuseColor.rgb *= 1.0 - 0.16 * joint * up;
        rfH = nz2.g * 0.5 + nz2.a * 0.2;
      }`,
    fnormal: /* glsl */ `normal = bumpNormal(normal, rfH, 0.012 / (1.0 + 0.02 * length(vViewPosition)));`,
  });
}

// ============================================================================ ground
export const GT = { city: 0, pave: 1, plaza: 2, grass: 3, lawn: 4, wood: 5, road: 6, turf: 7, court: 8, curb: 9, deck: 10, track: 11, steps: 12 };

export function groundMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  return patch(mat, {
    key: 'ground',
    vpars: /* glsl */ `attribute float aT; attribute vec2 aF; varying float vT; varying vec2 vFieldUv;`,
    vmain: /* glsl */ `vT = aT; vFieldUv = aF;`,
    fpars: /* glsl */ `varying float vT; varying vec2 vFieldUv;\n${BUMP_GLSL}`,
    fdiffuse: /* glsl */ `
      float gRough = 0.9; float gH = 0.0; float gBump = 0.0;
      {
        float T = floor(vT + 0.5);
        vec2 wp = vWPos.xz;
        float dist = length(vViewPosition);
        vec4 nA = texture2D(uNoise, wp * 0.0073);
        vec4 nB = texture2D(uNoise, wp * 0.061);
        vec4 nC = texture2D(uNoise, wp * 0.53);
        float fwp = max(fwidth(wp.x), fwidth(wp.y));
        vec3 col = diffuseColor.rgb;
        if (T < 0.5) {                      // city: light concrete pavers
          vec2 g = wp / 0.75; vec2 gi = floor(g); vec2 gf = fract(g);
          float e = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
          float jf = 1.0 - smoothstep(0.0, 0.5, fwp);
          float joint = (1.0 - smoothstep(0.0, 0.03 + fwp, e)) * jf;
          col = vec3(0.57, 0.56, 0.54) * (0.9 + 0.16 * hash21(gi) * jf);
          col *= 0.84 + 0.3 * nA.r; col *= 0.94 + 0.12 * nC.g;
          col = mix(col, col * 0.62, joint);
          gRough = 0.88; gH = nC.g * 0.4 - joint; gBump = 0.004;
        } else if (T < 1.5) {               // pave: warm grey / red brick pavers, running bond
          vec2 g = wp * vec2(1.0 / 0.4, 1.0 / 0.2); g.x += 0.5 * floor(g.y);
          vec2 gi = floor(g); vec2 gf = fract(g);
          float e = min(min(gf.x, 1.0 - gf.x) * 2.0, min(gf.y, 1.0 - gf.y));
          float jf = 1.0 - smoothstep(0.0, 0.16, fwp);
          float joint = (1.0 - smoothstep(0.0, 0.07 + fwp * 4.0, e)) * jf;
          float tv = hash21(gi);
          vec3 a = vec3(0.6, 0.56, 0.51), b = vec3(0.58, 0.44, 0.37);
          col = mix(a, b, smoothstep(0.42, 0.6, nB.r) * 0.75) * (0.86 + 0.24 * tv * jf);
          col *= 0.86 + 0.26 * nA.g; col *= 0.94 + 0.12 * nC.r;
          col = mix(col, col * 0.6, joint);
          gRough = 0.9; gH = nC.r * 0.5 - joint; gBump = 0.004;
        } else if (T < 2.5) {               // plaza: large granite slabs, two tones
          vec2 g = wp / 1.2; vec2 gi = floor(g); vec2 gf = fract(g);
          float e = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
          float jf = 1.0 - smoothstep(0.0, 0.7, fwp);
          float joint = (1.0 - smoothstep(0.0, 0.015 + fwp * 0.8, e)) * jf;
          float chk = mod(gi.x + gi.y, 2.0);
          col = mix(vec3(0.66, 0.64, 0.6), vec3(0.54, 0.53, 0.52), chk * 0.6 * jf) * (0.93 + 0.1 * hash21(gi) * jf);
          col *= 0.88 + 0.22 * nA.r; col *= 0.92 + 0.16 * nC.a;
          col = mix(col, col * 0.6, joint);
          gRough = 0.62 + 0.2 * nC.g; gH = nC.a * 0.25 - joint; gBump = 0.003;
        } else if (T < 5.5) {               // grass / lawn / woodland floor
          float woody = step(4.5, T);
          vec3 g1 = vec3(0.055, 0.125, 0.03), g2 = vec3(0.11, 0.2, 0.045), g3 = vec3(0.19, 0.21, 0.075);
          col = mix(g1, g2, smoothstep(0.3, 0.7, nB.r));
          col = mix(col, g3, smoothstep(0.55, 0.8, nA.g) * 0.55);
          col *= 0.72 + 0.56 * nC.g;
          col = mix(col, vec3(0.2, 0.16, 0.1), woody * (0.35 + 0.4 * smoothstep(0.4, 0.7, nB.g)));
          float stripe = sin(dot(wp, vec2(0.7, 0.7)) * 1.6);
          col *= 1.0 + 0.035 * stripe * (1.0 - woody) * step(3.5, T);
          gRough = 0.95; gH = nC.g + nC.a * 0.6; gBump = 0.02;
        } else if (T < 6.5) {               // asphalt
          col = vec3(0.105, 0.108, 0.115) * (0.8 + 0.5 * nA.r);
          col *= 0.86 + 0.3 * nC.a;
          col = mix(col, col * 1.35, smoothstep(0.6, 0.8, nB.g) * 0.5);       // worn lanes
          col = mix(col, col * 0.82, smoothstep(0.7, 0.85, nB.r));            // patches
          gRough = 0.82 + 0.12 * nC.g; gH = nC.a * 0.7 + nC.g * 0.3; gBump = 0.006;
        } else if (T < 7.5) {               // artificial turf with mowing bands
          float band = step(0.5, fract(vFieldUv.x / 11.0));
          col = mix(vec3(0.1, 0.36, 0.1), vec3(0.14, 0.43, 0.12), band);
          col *= 0.86 + 0.28 * nC.g;
          gRough = 0.95; gH = nC.g; gBump = 0.01;
        } else if (T < 8.5) {               // acrylic sports court (vertex colour)
          col *= 0.9 + 0.16 * nB.r; col *= 0.95 + 0.1 * nC.a;
          gRough = 0.7; gH = nC.a; gBump = 0.002;
        } else if (T < 9.5) {               // kerb stone
          col = vec3(0.6, 0.59, 0.56) * (0.85 + 0.25 * nC.r);
          gRough = 0.85;
        } else if (T < 10.5) {              // elevated deck: fair-faced concrete
          vec2 g = wp / 1.5; vec2 gf = fract(g);
          float e = min(min(gf.x, 1.0 - gf.x), min(gf.y, 1.0 - gf.y));
          float joint = (1.0 - smoothstep(0.0, 0.012 + fwp, e)) * (1.0 - smoothstep(0.0, 0.8, fwp));
          col = vec3(0.6, 0.6, 0.59) * (0.84 + 0.28 * nB.r) * (0.93 + 0.14 * nC.g);
          col = mix(col, col * 0.62, joint * step(0.5, vWNrm.y));
          gRough = 0.8; gH = nC.g * 0.4 - joint; gBump = 0.003;
        } else if (T < 11.5) {              // red rubber track
          col = vec3(0.56, 0.2, 0.14) * (0.85 + 0.3 * nC.a);
          gRough = 0.93; gH = nC.a; gBump = 0.004;
        } else {                            // stairs
          col = vec3(0.56, 0.56, 0.55) * (0.84 + 0.3 * nC.g);
          gRough = 0.85;
        }
        diffuseColor.rgb = col;
      }`,
    frough: /* glsl */ `roughnessFactor = gRough;`,
    fnormal: /* glsl */ `normal = bumpNormal(normal, gH, gBump / (1.0 + 0.05 * length(vViewPosition)));`,
  });
}

// ============================================================================ water
export function waterMaterial(pool = false) {
  const mat = new THREE.MeshStandardMaterial({
    color: pool ? 0x2aa7c9 : 0x0e3a3a, roughness: 0.04, metalness: 0.0, envMapIntensity: 1.6,
  });
  return patch(mat, {
    key: 'water' + (pool ? 'P' : ''),
    fpars: BUMP_GLSL,
    fdiffuse: /* glsl */ `
      float wH = 0.0;
      {
        vec2 wp = vWPos.xz;
        float a = texture2D(uNoise, wp * 0.045 + vec2(uTime * 0.012, uTime * 0.007)).g;
        float b = texture2D(uNoise, wp * 0.11 - vec2(uTime * 0.016, -uTime * 0.011)).r;
        float c = texture2D(uNoise, wp * 0.37 + vec2(-uTime * 0.02, uTime * 0.025)).g;
        wH = a * 0.6 + b * 0.35 + c * 0.14;
        diffuseColor.rgb *= 0.75 + 0.5 * a;
      }`,
    fnormal: /* glsl */ `normal = bumpNormal(normal, wH, ${pool ? '0.22' : '0.4'});`,
  });
}

// ============================================================================ vegetation
const WIND_VERT = /* glsl */ `
  {
    #ifdef USE_INSTANCING
      vec3 ip = instanceMatrix[3].xyz;
    #else
      vec3 ip = vec3(0.0);
    #endif
    float ph = ip.x * 0.37 + ip.z * 0.23;
    float hgt = max(0.0, position.y - WIND_BASE);
    float sway = sin(uTime * 1.1 + ph + position.y * 0.25) * 0.6 + sin(uTime * 2.3 + ph * 1.7 + position.x * 0.8) * 0.3;
    float flut = sin(uTime * 5.0 + position.x * 3.1 + position.z * 2.7 + ph) * 0.03;
    transformed.x += (sway * 0.035 + flut) * hgt * WIND_AMP;
    transformed.z += (sway * 0.022 - flut) * hgt * WIND_AMP;
  }`;

export function leafMaterial(map, { base = 2.0, amp = 1.0, key = 'leaf' } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, vertexColors: true,
  });
  patch(mat, {
    key,
    vpars: `#define WIND_BASE ${base.toFixed(2)}\n#define WIND_AMP ${amp.toFixed(2)}`,
    vbegin: WIND_VERT,
    // keep the smooth "puffy" normals on both faces and add cheap light transmission through the leaves
    fnormal: /* glsl */ `normal = normalize(vNormal);`,
    femissive: /* glsl */ `
      {
        vec3 Vw = normalize(cameraPosition - vWPos);
        float back = pow(saturate(dot(-Vw, uSunDir)), 3.0) * saturate(uSunDir.y * 4.0);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.9, 1.0, 0.45) * back * 0.55 * (1.0 - uNight);
      }`,
  });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.42 });
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, G);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\n#define WIND_BASE ${base.toFixed(2)}\n#define WIND_AMP ${amp.toFixed(2)}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND_VERT}`);
  };
  depth.customProgramCacheKey = () => key + '_depth';
  mat.userData.depth = depth;
  return mat;
}

export function barkMaterial(color = 0x6a5a4a) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
  return patch(mat, {
    key: 'bark',
    fpars: BUMP_GLSL,
    fdiffuse: /* glsl */ `
      float bkH = 0.0;
      {
        vec2 q = vec2(atan(vWNrm.z, vWNrm.x) * 1.3, vWPos.y * 0.35);
        vec4 nz = texture2D(uNoise, q * vec2(0.6, 0.25) + vWPos.xz * 0.05);
        bkH = nz.g + nz.a * 0.4;
        diffuseColor.rgb *= 0.6 + 0.8 * nz.g;
      }`,
    fnormal: /* glsl */ `normal = bumpNormal(normal, bkH, 0.035);`,
  });
}

export function allMaterials() {
  return allMats;
}
