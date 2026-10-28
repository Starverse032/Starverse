// a_star / earth — the Earth of S02-e / S02-f (front part): f1392 → f1680.
//
// One fullscreen ray-cast pass per frame over the baked lib/earth.js textures (land / albedo / clouds;
// the night-light map is never sampled — lights = 0: the first fire has no cities).  Every pixel
// intersects the exact sphere (no tessellation from 140 000 km down to 7 km altitude), the cloud deck
// as a second shell 9 km up (parallax at low altitude), and a thin exaggerated atmosphere (single
// scattering, 8 samples, Earth-shadowed: limb band, twilight ring at the terminator, airglow on the
// night limb).  Sun fixed in the Earth frame at the subsolar point (57.2°W, 0°): seen from above
// R_geo (36.8°E, 1.3°S) it is off-frame left, the lit crescent is the left ≈ 45 % of the disc and
// R_geo sits on the night side ≈ 3.5 % of a diameter right of the terminator.
// Exposure E(t) (−5 EV at f1440 → 0 EV at f1584) multiplies all Earth light; the background stars are
// born when their own brightness × E(t) crosses the visibility threshold (birthFrame(k)).
// From f1630 the view enters the air: the sky above the horizon becomes _clouds.js duskSky() (the A3
// sky, same function) and the far ground converges to A3's far-ground haze, so that f1680 — where the
// frame becomes _clouds.js itself — continues our f1679.
import * as THREE from 'three';
import { createEarth } from '../../lib/earth.js';
import * as C from './curves.js';
import { earthPose, applyEarthPose, G, ENU, SUN, pixelRay, hitSphere } from './geo.js';
import { createZoomComposite } from './shell.js';
import { RECT_VS, rectQuad } from './star.js';

const v3s = v => `vec3(${v.x.toFixed(6)}, ${v.y.toFixed(6)}, ${v.z.toFixed(6)})`;

export async function createEarthView(ctx, { needShellOverlap = false } = {}) {
  const { renderer, W, H, kit, GLSL, makeRT } = ctx;
  const S = H / 1080;
  const earth = await createEarth(ctx, { radius: 1, lightsW: 1024, landW: 4096, segments: 32 });
  // lib/earth.js material, cloned for this module with the night lights off (kept for reference /
  // parity with e_earth; the frame itself is drawn by the analytic pass below from the same textures)
  const surfClone = earth.globe.material.clone();
  surfClone.uniforms.lights.value = 0;
  const T = earth.textures;
  let SKY_GLSL = '';
  try { SKY_GLSL = (await import('../_clouds.js')).SKY_GLSL; } catch (e) { /* A3 not available: own sky */ }
  const haveSky = SKY_GLSL.length > 0;

  const cam = kit.filmCamera(W, H, { focalMM: 35, near: 1e-6, far: 1e3 });
  const U = {
    uProjInv: { value: new THREE.Matrix4() }, uCamW: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
    albedoTex: { value: T.albedoTex }, cloudTex: { value: T.cloudTex }, landTex: { value: T.landTex },
    uE: { value: 1 }, uAppear: { value: 1 }, uBack: { value: 0 }, uRimPx: { value: 1 }, uAir: { value: 0 }, uSky: { value: 0 }, uNight: { value: 0.2 }, uAltM: { value: 1e7 },
    uFpx: { value: C.FPX35 * S }, uFr: { value: 0 }, uStarDim: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: GLSL.common + GLSL.noise + SKY_GLSL + /* glsl */ `
      varying vec2 vUv;
      uniform mat4 uProjInv, uCamW; uniform vec3 uCam;
      uniform sampler2D albedoTex, cloudTex, landTex;
      uniform float uE, uAppear, uBack, uRimPx, uAir, uSky, uNight, uAltM, uFpx, uFr;
      const vec3 SUN = ${v3s(SUN)};
      const vec3 GE = ${v3s(ENU.east)}, GN = ${v3s(ENU.north)}, GU = ${v3s(ENU.up)}, GP = ${v3s(G)};
      const float HS = 0.0035;           // atmosphere scale height (unit radius; ≈ 22 km, exaggerated ×2.7 for the frame)
      const float RA = 1.03;             // top of the atmosphere
      const float RC = 1.0014;           // cloud deck (≈ 9 km)
      vec2 eqUV(vec3 n){ float lon = atan(n.x, n.z); float lat = asin(clamp(n.y, -1.0, 1.0));
        float u1 = lon / TAU + 0.5, u2 = fract(lon / TAU + 1.0); float u = fwidth(u1) <= fwidth(u2) + 1e-6 ? u1 : u2; return vec2(u, lat / PI + 0.5); }
      vec2 sph(vec3 ro, vec3 rd, float R){ float b = dot(ro, rd), c = dot(ro, ro) - R * R, d = b * b - c; if (d < 0.0) return vec2(-1.0); d = sqrt(d); return vec2(-b - d, -b + d); }
      vec3 toLocal(vec3 v){ return vec3(dot(v, GE), dot(v, GU), -dot(v, GN)); }
      // sun visibility at a point (Earth's shadow, softened; higher points see the sun longer)
      float sunVis(vec3 p){ float r = length(p); float mu = dot(p / r, SUN); float h = max(r - 1.0, 0.0);
        float lim = -sqrt(2.0 * h); return smoothstep(lim - 0.012, lim + 0.035, mu); }
      // single scattering along [t0, t1] (8 samples): returns in-scattered light, xyz, and optical depth in w
      vec4 atmo(vec3 ro, vec3 rd, float t0, float t1){
        vec3 acc = vec3(0.0); float tau = 0.0; float dt = (t1 - t0) / 8.0;
        float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        for (int i = 0; i < 8; i++){
          vec3 p = ro + rd * (t0 + (float(i) + jit) * dt);
          float r = length(p); float h = r - 1.0;
          float dn = exp(-max(h, 0.0) / HS);
          float mu = dot(p / r, SUN);
          float vis = sunVis(p);
          // light reaching the sample: reddened when the sun is low for it (long path along the limb)
          vec3 sunc = mix(vec3(1.0, 0.42, 0.16), vec3(1.0), smoothstep(-0.02, 0.22, mu));
          acc += dn * dt * vis * sunc;
          tau += dn * dt;
        }
        return vec4(acc, tau);
      }
      void main(){
        vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec3 rd = normalize(mat3(uCamW) * (v.xyz / v.w));
        vec3 ro = uCam;
        vec3 col = vec3(0.0); float alpha = 0.0;
        vec2 hg = sph(ro, rd, 1.0);
        float tg = hg.x > 0.0 ? hg.x : -1.0;
        // antialiased limb: signed distance of the ray from the sphere, in px
        float b = dot(ro, rd); vec3 pc = ro - rd * b; float dmin = length(pc);
        float tca = max(-b, 1e-6);
        float dpx = b < 0.0 ? (dmin - 1.0) / tca * uFpx : 1e6;      // rays leaving the planet never touch it
        float cov = clamp(0.5 - dpx, 0.0, 1.0);
        vec3 L = SUN;
        float phaseR = 0.75;
        // ---------------- surface ----------------
        if (cov > 0.0) {
          float tt = tg > 0.0 ? tg : tca;
          vec3 p = normalize(ro + rd * tt);
          vec2 uv = eqUV(p);
          vec4 alb = texture2D(albedoTex, uv);
          float land = alb.a;
          // detail (km scale) where the texture is too coarse: low altitude only
          float pxKm = tt * 6371.0 / uFpx / max(dot(p, -rd), 0.12);   // footprint, foreshortened
          float det = 1.0 - smoothstep(2.0, 12.0, pxKm);
          if (det > 0.0) {
            float n1 = fbm(p * 900.0, 4);
            alb.rgb *= mix(1.0, 0.65 + 0.7 * n1, det * land);
          }
          float ndl = dot(p, L);
          float lit = pow(max((ndl + 0.045) / 1.045, 0.0), 1.25);          // soft terminator (penumbra + scattering)
          // ground: Lambert + a narrow twilight band beyond the terminator
          vec3 g = alb.rgb * lit * 2.2 + alb.rgb * vec3(0.5, 0.4, 0.45) * 0.10 * smoothstep(-0.10, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.05, ndl));
          // ocean: sun glint + sky reflection on the lit side
          vec3 V = -rd; vec3 Hh = normalize(L + V); float nh = max(dot(p, Hh), 0.0);
          g += vec3(1.0, 0.86, 0.70) * (pow(nh, 260.0) * 0.9 + pow(nh, 40.0) * 0.05) * (1.0 - land) * smoothstep(0.0, 0.1, ndl);
          g += vec3(0.02, 0.05, 0.12) * (1.0 - land) * lit;
          // clouds on their own shell (parallax), lit at their own height (tops catch the sun past the terminator)
          vec2 hc = sph(ro, rd, RC);
          vec3 pcld = normalize(ro + rd * (hc.x > 0.0 ? hc.x : tt));
          vec2 cuv = eqUV(pcld);
          float cl = texture2D(cloudTex, cuv).r;
          // the deck the camera falls into: broken stratocumulus around R_geo (≈ 600 km), joining A3's decks
          float nearG = smoothstep(0.11, 0.03, distance(pcld, GP));
          // footprint-aware: cells smaller than a few px fade to their mean (no shimmer from far away)
          float wLo = 1.0 - smoothstep(3.0, 8.0, pxKm), wHi = 1.0 - smoothstep(0.8, 2.0, pxKm);
          float nLo = wLo > 0.0 ? fbm(pcld * 150.0 + 3.0, 4) : 0.47;
          float nHi = wHi > 0.0 ? fbm(pcld * 640.0 + 11.0, 3) : 0.47;
          float deckN = mix(0.47, nLo, wLo) * 0.62 + mix(0.47, nHi, wHi) * 0.38;
          float deck = mix(0.6, smoothstep(0.40, 0.52, deckN), max(wLo, 0.0));
          cl = max(cl, deck * nearG * 0.96);
          float tops = mix(1.0, 0.55 + 0.9 * smoothstep(0.50, 0.66, deckN), nearG);
          float cdet = 1.0 - smoothstep(1.5, 8.0, pxKm);
          if (cdet > 0.0) { float d2 = fbm(pcld * 2600.0, 4); cl = clamp(cl * mix(1.0, 0.35 + 1.3 * d2, cdet) + 0.08 * cdet * (d2 - 0.5), 0.0, 1.0); }
          float cndl = dot(pcld, L);
          float cvis = smoothstep(-0.058, -0.02, cndl);                         // cloud tops see the sun ≈ 3° longer
          vec3 csun = mix(vec3(1.0, 0.45, 0.30), vec3(1.0, 0.97, 0.94), smoothstep(-0.02, 0.18, cndl));   // pink-orange on the terminator
          vec3 cc = vec3(0.92) * csun * (pow(max((cndl + 0.07) / 1.07, 0.0), 1.15) * 2.0 + 0.16 * cvis * (1.0 - smoothstep(0.0, 0.06, cndl)));
          // night: the tops lit by the twilight sky above (A3's cloud ambient), warm towards the western twilight
          float tw = exp(-max(-cndl, 0.0) / 0.06);
          cc += (vec3(0.060, 0.066, 0.092) + vec3(0.22, 0.12, 0.080) * tw) * uNight * tops;   // night: grey-blue (sky glow), brighter near the twilight
          g = mix(g, cc, cl * 0.92);
          g += alb.rgb * vec3(0.4, 0.5, 0.8) * (0.006 + 0.012 * uNight) * (1.0 - smoothstep(-0.05, 0.05, ndl));   // night ground: starlight only
          // air between the camera and the ground
          vec2 ha = sph(ro, rd, RA);
          float ta0 = max(ha.x, 0.0);
          vec4 A = atmo(ro, rd, ta0, tt);
          g = g * exp(-A.w / HS * 0.08) + vec3(0.16, 0.38, 1.0) * A.xyz / HS * 0.020 * phaseR;
          col = g * uE;
          // close to the ground (A3's frame): the far ground in dusk haze, same formula as _clouds.js
          ${haveSky ? `
          if (uAir > 0.0) {
            vec3 lp = toLocal(ro + rd * tt - GP) * 6371000.0;
            float dist = tt * 6371000.0;
            float vv = 0.5 + 0.5 * sin(lp.x / 3100.0) * sin(lp.z / 2700.0 + 1.3);
            vec3 fa = mix(vec3(0.014, 0.013, 0.012), vec3(0.024, 0.021, 0.018), vv);
            vec3 ld = toLocal(rd);
            vec3 fg = mix(fa, duskHaze(ld, uAltM) * 0.55, 1.0 - exp(-dist / 45000.0));
            col = mix(col, fg, uAir);
          }` : ''}
          alpha = cov * uAppear;
          col *= uAppear;
        }
        // ---------------- sky: atmosphere seen against space (limb), or from inside ----------------
        if (cov < 1.0) {
          vec2 ha = sph(ro, rd, RA);
          vec3 sky = vec3(0.0);
          if (ha.y > 0.0) {
            float t0 = max(ha.x, 0.0), t1 = ha.y;
            if (tg > 0.0) t1 = min(t1, tg);
            vec4 A = atmo(ro, rd, t0, t1);
            sky = vec3(0.16, 0.38, 1.0) * A.xyz / HS * 0.034 * phaseR * uE;
            // airglow: a thin green line ≈ 95 km on the night limb
            float hmin = dmin - 1.0;
            float night = 1.0 - smoothstep(-0.15, 0.05, dot(normalize(pc), L));
            sky += vec3(0.10, 0.55, 0.25) * 0.10 * exp(-pow((hmin - 0.0090) / 0.0016, 2.0)) * night * step(tg, 0.0) * mix(0.25, 1.0, uE) * (1.0 - uSky);
          }
          // the far shell's light scattered forward through the limb: a cold-white line (substitution ②)
          float hpx = dpx;
          vec2 sd = normalize((vUv - vec2(${(C.RX/1920).toFixed(5)}, ${(1 - C.RY/1080).toFixed(5)})) * vec2(1.7778, 1.0) + 1e-5);
          float bside = 0.45 + 0.75 * max(0.0, dot(sd, normalize(vec2(-0.75, 0.6))));
          sky += vec3(0.78, 0.90, 1.0) * uBack * bside * exp(-max(hpx, 0.0) / (uRimPx * (0.7 + 0.9 * bside))) * smoothstep(-1.0, 0.0, hpx) * uAppear;
          ${haveSky ? `
          if (uSky > 0.0) sky = mix(sky, duskSky(toLocal(rd), uAltM), uSky);` : ''}
          col += sky * (1.0 - cov);
        }
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const fsq = new ctx.FSQ(mat);

  // ---------------- background stars: births tied to E(t) ----------------
  // directions fixed in the Earth frame, chosen on the f1500 (nadir) frame: outside the f1584 disc, out
  // of the card box, spread so that stars born on the same frame are > 200 px apart (K24)
  const rng = ctx.util.rng(55 * 1000 + 1452);
  const pose0 = earthPose(1500); applyEarthPose(cam, pose0, 1920, 1080);
  const placed = [];
  const birth = k => C.birthFrame(k);
  for (let k = 0; k < C.N_STARS; k++) {
    const fb = Math.floor(birth(k));
    let best = null;
    for (let tries = 0; tries < 400 && !best; tries++) {
      const x = 20 + rng() * 1880, y = 150 + rng() * 780;
      const dx = x - C.RX, dy = y - C.RY;
      if (Math.hypot(dx, dy) < 250) continue;                                 // behind the f1584 disc
      if (x > 560 && x < 1360 && y > 715 && y < 850) continue;              // card ① box (+ margin)
      if (y > 780) continue;                                                 // keep the lower band dark under the card
      let ok = true;
      for (const p of placed) {
        if (Math.floor(p.f) === fb && Math.abs(p.x - x) < 210 && Math.abs(p.y - y) < 210) { ok = false; break; }
        if (Math.hypot(p.x - x, p.y - y) < 40) { ok = false; break; }
      }
      if (ok) best = { x, y };
    }
    if (!best) continue;
    const d = pixelRay(cam, best.x, best.y);
    placed.push({ x: best.x, y: best.y, f: birth(k), d, T: 6500 + Math.pow(rng(), 1.5) * 9000 });
  }
  const NS = placed.length;
  const sPos = new Float32Array(NS * 6 * 3), sCorner = new Float32Array(NS * 6 * 2), sAttr = new Float32Array(NS * 6 * 3);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
  placed.forEach((p, i) => {
    // intrinsic brightness: exactly at the threshold when E(t) lets it through (E grows, so earlier = brighter)
    const thr = 0.20, b = thr / C.exposureE(p.f);
    for (let c = 0; c < 6; c++) {
      const o = i * 6 + c;
      sPos.set([p.d.x, p.d.y, p.d.z], o * 3); sCorner.set(corners[c], o * 2); sAttr.set([p.f, Math.min(b, 6), p.T], o * 3);
    }
  });
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sg.setAttribute('aCorner', new THREE.BufferAttribute(sCorner, 2));
  sg.setAttribute('aStar', new THREE.BufferAttribute(sAttr, 3));
  const SU = { uVPa: { value: new THREE.Matrix4() }, uVPb: { value: new THREE.Matrix4() }, uFr: { value: 0 }, uE: { value: 1 }, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uDim: { value: 1 } };
  const smat = new THREE.ShaderMaterial({
    uniforms: SU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: GLSL.common + /* glsl */ `
      attribute vec2 aCorner; attribute vec3 aStar;
      uniform mat4 uVPa, uVPb; uniform float uFr, uE, uS, uDim; uniform vec2 uRes;
      varying vec2 vQ; varying float vLen, vI; varying vec3 vCol;
      void main(){
        vec4 ca = uVPa * vec4(position, 0.0), cb = uVPb * vec4(position, 0.0);
        vec2 a = ca.xy / ca.w * 0.5 * uRes, b = cb.xy / cb.w * 0.5 * uRes;
        vec2 m = 0.5 * (a + b), dv = b - a; float len = length(dv);
        vec2 t = len > 1e-3 ? dv / len : vec2(1.0, 0.0), n = vec2(-t.y, t.x);
        float rad = 3.0 * uS;
        vec2 px = m + t * aCorner.x * (0.5 * len + rad) + n * aCorner.y * rad;
        gl_Position = (ca.w > 0.0 && cb.w > 0.0) ? vec4(px / (0.5 * uRes), 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
        vQ = vec2(aCorner.x * (0.5 * len + rad), aCorner.y * rad); vLen = 0.5 * len;
        float age = uFr - aStar.x;
        float ramp = smoothstep(0.0, 6.0, age);                       // 6-frame rise
        vI = aStar.y * uE * ramp * uDim * (age > 0.0 ? 1.0 : 0.0);
        vCol = blackbody(aStar.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uS; varying vec2 vQ; varying float vLen, vI; varying vec3 vCol;
      void main(){
        // a 2 px gaussian point swept along the shutter path (energy kept)
        float x = max(abs(vQ.x) - vLen, 0.0), y = vQ.y;
        float s = 0.85 * uS;
        float g = exp(-0.5 * (x * x + y * y) / (s * s)) / (1.0 + vLen / (1.2 * uS));
        gl_FragColor = vec4(vCol * vI * g, 1.0);
      }`,
  });
  const starMesh = new THREE.Mesh(sg, smat); starMesh.frustumCulled = false;
  const starScene = new THREE.Scene(); starScene.add(starMesh);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const camA = kit.filmCamera(W, H, { focalMM: 35 }), camB = kit.filmCamera(W, H, { focalMM: 35 });
  const vp = (c) => { const m = new THREE.Matrix4().copy(c.matrixWorldInverse); m.setPosition(0, 0, 0); return new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, m); };

  // ---------------- the edge sweep of substitution ② (screen space, f1400–1432) ----------------
  const WU = { uRect: { value: new THREE.Vector4(0, 0, 1920, 1080) }, uR: { value: 700 }, uA: { value: 0 }, uFr: { value: 0 } };
  const wmat = new THREE.ShaderMaterial({
    uniforms: WU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: RECT_VS,
    fragmentShader: GLSL.common + GLSL.noise + /* glsl */ `
      float anoise(float th, float k, float y){ return vnoise(vec3(cos(th) * k / 6.2831853, sin(th) * k / 6.2831853, y)); }
      varying vec2 vPx; uniform float uR, uA, uFr;
      void main(){
        vec2 d = vPx - vec2(${C.RX.toFixed(1)}, ${C.RY.toFixed(1)});
        float r = length(d), th = atan(d.y, d.x);
        // radial scatter streaks: thin rays, broken along their length, moving outward with the front
        float rays = pow(anoise(th, 160.0, 0.0), 3.0) * 0.8 + pow(anoise(th, 47.0, 5.0), 2.0) * 0.5;
        float along = anoise(th, 30.0, r / 90.0 - uFr * 0.9);
        float front = exp(-pow((r - uR) / (0.16 * uR), 2.0));
        float behind = smoothstep(uR * 0.55, uR, r) * (1.0 - smoothstep(uR, uR * 1.25, r));
        float e = (0.9 * front + 0.45 * behind * rays * (0.4 + 0.6 * along));
        // edge weighting: the over-exposure lives at the frame edges, never in the centre
        float edge = smoothstep(380.0, 760.0, r);
        vec3 c = mix(vec3(0.30, 0.62, 1.0), vec3(0.70, 0.86, 1.0), front) * e * edge * uA;
        gl_FragColor = vec4(c * 0.16, 1.0);
      }`,
  });
  const sweepQ = rectQuad(wmat);

  // ---------------- the far half of the shell seen from (almost) inside: a cold glowing bowl behind R ---
  const BU = { uRect: { value: new THREE.Vector4(0, 0, 1920, 1080) }, uA: { value: 0 }, uRb: { value: 900 }, uFr: { value: 0 } };
  const bmat = new THREE.ShaderMaterial({
    uniforms: BU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: RECT_VS,
    fragmentShader: GLSL.common + GLSL.noise + /* glsl */ `
      float anoise(float th, float k, float y){ return vnoise(vec3(cos(th) * k / 6.2831853, sin(th) * k / 6.2831853, y)); }
      varying vec2 vPx; uniform float uA, uRb, uFr;
      void main(){
        vec2 d = vPx - vec2(${C.RX.toFixed(1)}, ${C.RY.toFixed(1)});
        float r = length(d), x = r / uRb, th = atan(d.y, d.x);
        // concave far wall: brighter towards its own rim, gas sheets and filaments that expand with it
        float prof = (0.55 + 0.75 * x * x) * exp(-pow(max(x - 0.9, 0.0) / 0.35, 2.0));
        float lr = log(max(r, 1.0)) - log(uRb);
        vec3 qd = vec3(cos(th), sin(th), lr * 2.4);
        float sheet = fbm(qd * vec3(1.6, 1.6, 1.0) + 7.0, 4);
        // filaments: thin arcs along the bowl (ridges stretched across the radius), soft
        float fil = pow(1.0 - abs(2.0 * fbm(qd * vec3(2.2, 2.2, 2.6) + 3.0, 3) - 1.0), 10.0);
        float side = 1.0 + 0.45 * dot(normalize(d + 1e-3), normalize(vec2(-0.75, -0.6)));   // the bright side (upper left)
        vec3 c = mix(vec3(0.20, 0.42, 1.0), vec3(0.18, 0.78, 0.82), 0.55 * smoothstep(0.45, 0.8, sheet));
        float I = prof * side * (0.45 + 0.9 * sheet + 0.45 * fil);
        gl_FragColor = vec4(c * I * uA, 1.0);
      }`,
  });
  const bowlQ = rectQuad(bmat);

  const rtE = makeRT(W, H);
  const rtMix = makeRT(W, H);
  const zoom = createZoomComposite(ctx, { over: true });
  const mixPass = kit.fullscreen(/* glsl */ `uniform sampler2D a, b; uniform float k; void main(){ vec4 A = texture2D(a, vUv); gl_FragColor = vec4(mix(A.rgb, texture2D(b, vUv).rgb, k), A.a); }`,
    { a: { value: null }, b: { value: null }, k: { value: 0 } });
  const clouds3 = { n: null };

  function setFrame(fr) {
    const pose = earthPose(fr);
    applyEarthPose(cam, pose, W, H);
    U.uProjInv.value.copy(cam.projectionMatrixInverse);
    U.uCamW.value.copy(cam.matrixWorld);
    U.uCam.value.copy(cam.position);
    U.uFr.value = fr;
    U.uE.value = C.exposureE(fr);
    U.uAppear.value = C.s5(1393, 1400, fr);
    // far-shell back light on the limb: strong while the bowl is behind (f1400–1440), its last arc lingers
    // to ≈ f1470 and hands over to the (sunlit) atmosphere
    U.uBack.value = 0.55 * C.s5(1394, 1402, fr) * (1 - C.s5(1438, 1474, fr));
    U.uRimPx.value = 1.1 * S;
    const altKm = (cam.position.length() - 1) * C.R_EARTH_KM;
    U.uAltM.value = altKm * 1000;
    U.uSky.value = C.s5(1640, 1668, fr);                                 // inside the air: A3's dusk sky
    U.uAir.value = C.s5(1658, 1677, fr);
    // night-side clouds: ≤ L 6 on the disc (no city lights, K27), grey-blue once we fly over them (S02-f)
    U.uNight.value = 0.22 + 0.78 * C.s5(1590, 1640, fr);                                 // and A3's far-ground haze
    return pose;
  }
  function drawStars(fr, target) {
    applyEarthPose(camA, earthPose(fr - 0.25), W, H); applyEarthPose(camB, earthPose(fr + 0.25), W, H);
    SU.uVPa.value.copy(vp(camA)); SU.uVPb.value.copy(vp(camB));
    SU.uFr.value = fr; SU.uE.value = C.exposureE(fr);
    SU.uDim.value = 1 - C.s5(1636, 1668, fr);                       // the twilight sky swallows them
    renderer.setRenderTarget(target);
    renderer.render(starScene, ortho);
  }

  return {
    stars: placed,
    count: NS,
    renderBowl(fr, target) {
      const a = C.s5(1386, 1400, fr) * (1 - C.s5(1436, 1500, fr));
      if (a <= 0.001) return;
      BU.uA.value = 0.085 * a; BU.uFr.value = fr;
      BU.uRb.value = 820 * Math.exp(0.012 * (fr - 1400));                 // the bowl recedes slowly (it is far)
      renderer.setRenderTarget(target);
      renderer.render(bowlQ.scene, bowlQ.cam);
    },
    renderSweep(fr, target) {
      const s = C.sweep(fr);
      if (s.a <= 0.001) return;
      WU.uR.value = s.r; WU.uA.value = s.a; WU.uFr.value = fr;
      renderer.setRenderTarget(target);
      renderer.render(sweepQ.scene, sweepQ.cam);
    },
    /** draw the Earth (+ stars) into f.target; opts.clouds: the _clouds.js instance for f1660–1679 */
    render(f, opts = {}) {
      const fr = f.t * 24;
      setFrame(fr);
      const blur = fr >= 1584;
      if (!blur) {
        if (fr >= 1452) drawStars(fr, f.target);
        fsq.render(renderer, f.target);
        return;
      }
      // sprint: render into rtE, (clouds fade in over it from f1660), then the zoom blur about R
      drawStars(fr, f.target);                                        // stars are at infinity: never zoom-blurred
      renderer.setRenderTarget(rtE); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
      fsq.render(renderer, rtE);
      let src = rtE;
      const wc = opts.clouds ? C.s5(1660, 1679, fr) : 0;
      if (wc > 0) {
        // A3's decks drawn from their own camera at the same slant distance (on the 4.5° glide line;
        // our line of sight is within ≈ 2° of it by f1660), over our frame as the base
        const nEff = 1680 - Math.log(C.slantKm(fr) / C.S1680) / (Math.log(3) / 24);
        opts.clouds.render({ t: nEff / 24, target: rtMix }, { base: rtE.texture, blur: false, target: rtMix });
        mixPass.material.uniforms.a.value = rtE.texture; mixPass.material.uniforms.b.value = rtMix.texture; mixPass.material.uniforms.k.value = wc;
        const tmp = makeRTcache();
        mixPass.render(renderer, tmp);
        src = tmp;
      }
      // the image a quarter frame earlier / later is scaled about R by the slant ratio
      const s0 = C.slantKm(fr), lo = C.slantKm(fr - 0.25) / s0, hi = C.slantKm(fr + 0.25) / s0;
      renderer.setRenderTarget(f.target);
      zoom.apply(src.texture, f.target, hi, lo, 1, fr);
    },
  };
  function makeRTcache() { if (!clouds3.n) clouds3.n = makeRT(W, H); return clouds3.n; }
}
