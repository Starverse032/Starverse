// m_asking/antenna.js — S23 天线 (112.083 → 112.5, 10 frames, f2690–2699).
//
// A radio dish standing in a karst sinkhole, seen from the sinkhole floor, 50 mm, looking up ≈ 14°.
// Pure silhouette: the bowl (a real paraboloid, D = 64 m, f/D 0.38, its axis 19° off the zenith,
// leaning towards us so the rim is a thin ellipse) on its mount and tower, all near black, cut out of the
// Milky Way (the shared f_fire galaxy bake) and the airglow. The only light on the structure is the sky
// catching the rim: a single elliptical line (screen-space ribbon, analytic coverage, 1.3 px) — and at
// the heart of the dish, the centre of that ellipse, the red indicator lamp (FEED #FF4A3A, HDR 2) on R:
// the first lamp people ever pointed at the sky. No beam, no feed legs, no cabin, no cables, no platform.
//
// Karst cones (fengcong) ring the sinkhole in four layers (sinkhole floor 120 m, walls 600 m, cones
// 1.5 km and 3.5 km): profiles baked once (CPU, deterministic) as elevation(azimuth), drawn per pixel
// with aerial perspective (farther = closer to the sky colour, the airglow tinting the haze).
//
// Motion (montage rule: a time-lapse drift of 2–4 % of the frame per second, direction alternating):
// the camera trucks 2 m to the right while staying aimed at the lamp, which therefore stays exactly on
// R; the dish slides against the cones and the cones against the stars — depth in ten frames.
import * as THREE from 'three';
import { hex, RX, RY, fbm1 } from '../f_fire/common.js';
import { bakeGalaxy, skyFrame, SKY_GLSL, makeStars, L_SPAN, B_SPAN } from '../f_fire/sky.js';

const D2R = Math.PI / 180;
const T0 = 112.083, DUR = 0.417;
const FEED = hex(0xFF4A3A), AIRGLOW = hex(0x7FE3C2);

// dish (metres, world y up; camera on the sinkhole floor looking towards −z)
const DISH_D = 64, DISH_F = 24.3;                  // diameter, focal length (f/D 0.38)
const DEPTH = (DISH_D / 2) ** 2 / (4 * DISH_F);   // 10.5 m
const axis = lean => new THREE.Vector3(-Math.sin(lean * D2R) * Math.sin(18 * D2R), Math.cos(lean * D2R), Math.sin(lean * D2R) * Math.cos(18 * D2R)).normalize();
// the lamp sits at the centre of the aperture (the "heart" of the dish), at the same point in the world
// as the v1 feed lamp, so the camera aim, the sky and the hills are unchanged; the dish is raised to put
// its aperture there. The axis leans 19° towards us (and a little left): from the floor the rim plane is
// seen almost edge-on, a thin ellipse around the lamp.
const LAMP = new THREE.Vector3(-4, 34, -212).addScaledVector(axis(15), DISH_F + 2.1);
const AX = axis(19);
const VTX = LAMP.clone().addScaledVector(AX, -(DEPTH + 0.05));   // vertex of the paraboloid (top of the mount)

// hills: [distance m, haze 0..1] for the four layers (R, G, B, A of the profile texture)
const LAYERS = [[600, 0.16], [1500, 0.34], [3500, 0.6], [120, 0.0]];
const AZ0 = -40, AZ1 = 45, NP = 2048;

export function createAntenna(ctx) {
  const { renderer, W, H, kit, GLSL, util } = ctx;
  const S = H / 1080;

  // ---- cameras: `cam` moves (meshes); `skyCam` = same rotation at the origin (sky, stars, hills) -----
  const cam = kit.filmCamera(W, H, { focalMM: 50, near: 1, far: 20000 });
  cam.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
  const skyCam = kit.filmCamera(W, H, { focalMM: 50, near: 1, far: 20000 });
  skyCam.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
  const camX = t => -1.0 + 2.0 * util.clamp((t - T0) / DUR, -0.2, 1.4);
  const setCam = t => {
    cam.position.set(camX(t), 1.6, 0); cam.up.set(0, 1, 0); cam.lookAt(LAMP);
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    skyCam.position.set(0, 0, 0); skyCam.quaternion.copy(cam.quaternion);
    skyCam.updateMatrixWorld(); skyCam.updateProjectionMatrix();
  };
  setCam(T0 + DUR / 2);

  // ---- sky: the shared Milky Way, placed so the band climbs behind the dish from lower left ---------
  const gal = bakeGalaxy(ctx);
  const M = skyFrame(skyCam, [900, 560], 36, 16, -1.0);
  const stars = makeStars(ctx, gal, { count: 300000, seed: 2323 });
  stars.setFrame(M);
  stars.uniforms.uExt.value = 0.16; stars.uniforms.uGain.value = 1.25;
  const starScene = new THREE.Scene(); starScene.add(stars.pts);

  // ---- hill profiles (deg of elevation by azimuth, terrain coordinates) -----------------------------
  const prof = new Float32Array(NP * 4);
  const cone = (az, c, w, h, k = 0.75) => { const d = Math.abs(az - c) / w; return d >= 1 ? -90 : h * Math.pow(1 - d * d, k); };
  // fengcong: rounded cones about as wide as they are high (angular sizes, deg) [centre, half-width, height]
  const L3 = [[-38, 6.5, 8.4], [-30, 5.6, 9.4], [-22, 6.2, 8.6], [-14, 5.4, 9.6], [-6, 6.0, 8.4], [1, 5.4, 9.0], [8, 6.6, 9.9], [15, 5.6, 8.6], [21, 6.4, 10.2], [28, 5.8, 9.0], [35, 6.4, 9.8], [42, 5.6, 8.6]];
  const L2 = [[-33, 7.5, 11.6], [-24, 6.5, 10.4], [-12, 7.0, 10.2], [-3, 5.6, 8.6], [6, 6.2, 9.4], [16, 9.0, 12.8], [26, 7.0, 11.0], [37, 8.0, 12.2]];
  const L1 = [[-33, 17, 16.5], [-17, 8, 12.0], [33, 15, 16.0], [24, 6, 11.4]];
  for (let i = 0; i < NP; i++) {
    const az = AZ0 + (AZ1 - AZ0) * i / (NP - 1);
    const fz = (s, a, sd) => a * (fbm1(az / s + sd * 0.37, 4, sd) - 0.5);
    let e3 = 5.4 + fz(6, 1.2, 231), e2 = 4.0 + fz(5, 1.0, 232), e1 = -90;
    for (const [c, w, h] of L3) e3 = Math.max(e3, cone(az, c, w, h) + fz(1.1, 0.4, 233) + fz(2.6, 1.0, 243));
    for (const [c, w, h] of L2) e2 = Math.max(e2, cone(az, c, w, h, 0.5) + fz(0.8, 0.5, 234) + fz(2.2, 1.4, 244));
    for (const [c, w, h] of L1) e1 = Math.max(e1, cone(az, c, w, h, 0.5) + fz(0.6, 0.7, 235) + fz(3.0, 2.6, 245));
    // the canopy on every crest: fine fuzz (trees on the cones), stronger on the near layers
    e1 += fz(0.09, 0.35, 236) + fz(0.03, 0.12, 237);
    e2 += fz(0.06, 0.16, 238);
    // sinkhole floor and scrub 120 m away: low, rising towards the frame edges
    const e0 = 4.0 + 0.0026 * az * az + fz(4, 1.3, 239) + fz(0.4, 0.45, 240) + fz(0.08, 0.3, 241);
    prof[4 * i] = e1; prof[4 * i + 1] = e2; prof[4 * i + 2] = e3; prof[4 * i + 3] = e0;
  }
  const profTex = new THREE.DataTexture(prof, NP, 1, THREE.RGBAFormat, THREE.FloatType);
  profTex.minFilter = profTex.magFilter = THREE.LinearFilter; profTex.needsUpdate = true;

  // ---- fullscreen passes ------------------------------------------------------------------------------
  const RAY = /* glsl */ `
    uniform mat4 uInvVP; uniform vec2 uRes; uniform float uS;
    vec3 rayDir(){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;
      vec2 ndc = vec2(px.x / 1920.0 * 2.0 - 1.0, 1.0 - px.y / 1080.0 * 2.0);
      vec4 p = uInvVP * vec4(ndc, 1.0, 1.0); return normalize(p.xyz / p.w);
    }`;
  const U = {
    uInvVP: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S },
    uM: { value: M }, uGal: { value: gal }, uL: { value: L_SPAN }, uB: { value: B_SPAN },
    uProf: { value: profTex }, uCamX: { value: 0 }, uAirC: { value: new THREE.Vector3(...AIRGLOW) },
    uAz: { value: new THREE.Vector2(AZ0, AZ1) },
  };
  const sky = kit.fullscreen(SKY_GLSL + RAY + /* glsl */ `
    uniform mat3 uM; uniform sampler2D uGal; uniform float uL, uB; uniform vec3 uAirC;
    void main(){
      vec3 d = rayDir(); float el = asin(clamp(d.y, -1.0, 1.0));
      vec3 col = skyBase(el, 1.15);
      // the airglow: a faint green layer ~10° up, brightest towards the horizon (van Rhijn)
      col += uAirC * 0.0085 * exp(-pow((el / DG - 9.0) / 7.0, 2.0)) + uAirC * 0.0040 * exp(-max(el, 0.0) / 0.30);
      col += galaxy(uGal, uM, d, uL, uB) * extinction(el, 0.16) * 0.30;
      gl_FragColor = vec4(col, 1.0);
    }`, U);
  // hills: premultiplied "over" (they hide the stars); also writes the near floor in a second pass
  const hillFrag = near => SKY_GLSL + RAY + /* glsl */ `
    uniform sampler2D uProf; uniform float uCamX; uniform vec2 uAz; uniform vec3 uAirC;
    float ridge(float az, int k, float dist){
      float a = az + uCamX / dist / DG;                     // parallax of the truck
      vec4 p = texture2D(uProf, vec2((a - uAz.x) / (uAz.y - uAz.x), 0.5));
      return k == 0 ? p.r : k == 1 ? p.g : k == 2 ? p.b : p.a;
    }
    float cover(float el, float r){ float w = 0.012; return smoothstep(r + w, r - w, el); }   // ≈ 0.6 px soft edge
    void main(){
      vec3 d = rayDir(); float el = asin(clamp(d.y, -1.0, 1.0)) / DG, az = atan(d.x, -d.z) / DG;
      vec3 col = vec3(0.0); float a = 0.0;
      ${near ? `
      float c0 = cover(el, ridge(az, 3, 120.0));
      col = vec3(0.00018, 0.00020, 0.00026); a = c0;
      ` : `
      // back to front: 3.5 km, 1.5 km, 600 m
      float dists[3]; dists[0] = 3500.0; dists[1] = 1500.0; dists[2] = 600.0;
      float haze[3]; haze[0] = 0.85; haze[1] = 0.55; haze[2] = 0.26;
      int ks[3]; ks[0] = 2; ks[1] = 1; ks[2] = 0;
      for (int i = 0; i < 3; i++){
        float r = ridge(az, ks[i], dists[i]);
        float c = cover(el, r);
        if (c <= 0.0) continue;
        // aerial perspective: the haze in front of the hill glows like the low sky (airglow-tinted)
        float e = max(r * DG, 0.0);
        vec3 hz = skyBase(e * 0.5, 1.15) + uAirC * 0.0060;
        // a little brighter just under the crest (the haze is thicker along the grazing line)
        float under = exp(-(r - el) / 1.2);
        vec3 hc = hz * haze[i] * (0.82 + 0.18 * under) + vec3(0.00016, 0.00018, 0.00024);
        col = mix(col, hc, c); a = a + (1.0 - a) * c;
      }
      `}
      gl_FragColor = vec4(col * a, a);
    }`;
  const hills = kit.fullscreen(hillFrag(false), U), floor = kit.fullscreen(hillFrag(true), U);
  premult(hills.material); premult(floor.material);

  // ---- the structure (near-black meshes, depth-tested) ----------------------------------------------
  const darkMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uLamp: { value: LAMP.clone() }, uFeed: { value: new THREE.Vector3(...FEED) } },
    vertexShader: /* glsl */ `varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLamp, uFeed; varying vec3 vW, vN;
      void main(){
        // night-sky irradiance on white-painted steel: a hair above black, more on faces turned up
        // and the inside of the bowl is a dull mirror: it shows the sky it faces (a pale sliver)
        vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vW); if (dot(n, V) < 0.0) n = -n;
        float up = 0.5 + 0.5 * n.y;
        vec3 c = vec3(0.00030, 0.00036, 0.00052) * (0.5 + 1.2 * up * up);
        vec3 Rf = reflect(-V, n);
        if (Rf.y > 0.0) c += (vec3(0.0026, 0.0036, 0.0062) + vec3(0.006, 0.010, 0.009) * exp(-Rf.y / 0.2)) * 0.45;
        // the lamp's spill on the steel around it (negligible beyond a few metres)
        float dl = length(vW - uLamp);
        c += uFeed * 0.08 / (1.0 + dl * dl * 1.2) * max(dot(n, normalize(uLamp - vW)), 0.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const meshScene = new THREE.Scene();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), AX);
  {
    // the bowl: lathe of the parabola y = r²/4f, a thin lip
    const pts = [];
    for (let i = 0; i <= 40; i++) { const r = (DISH_D / 2) * i / 40; pts.push(new THREE.Vector2(Math.max(r, 0.01), r * r / (4 * DISH_F))); }
    pts.push(new THREE.Vector2(DISH_D / 2 + 0.25, DEPTH + 0.05));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 160), darkMat);
    bowl.quaternion.copy(q); bowl.position.copy(VTX);
    // the back-up structure: a shallow cone behind the vertex (what makes a dish read as engineered)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 2.5, 4.0, 48, 1, false), darkMat);
    hub.quaternion.copy(q); hub.position.copy(VTX).addScaledVector(AX, -1.6);
    // the mount: one slender tapered pedestal from the floor up into the hub (a clean silhouette)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.6, VTX.y - 2.0, 40), darkMat);
    tower.position.set(VTX.x, (VTX.y - 2.0) / 2, VTX.z);
    meshScene.add(bowl, hub, tower);
  }

  // ---- lines: the rim highlight, as screen-space ribbons with analytic coverage ------
  // Each segment = a quad; the vertex shader projects both ends, offsets by the screen normal by
  // (half width + 1 px), the fragment shader turns the signed distance into coverage. Width below
  // 1 px fades intensity instead of thinning (no crawling, no stair steps).
  const segs = [];   // [ax,ay,az, bx,by,bz, widthM, kind]
  const rimC = VTX.clone().addScaledVector(AX, DEPTH + 0.05);
  const e1 = new THREE.Vector3(1, 0, 0).applyQuaternion(q), e2 = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const rimP = a => rimC.clone().addScaledVector(e1, Math.cos(a) * (DISH_D / 2 + 0.25)).addScaledVector(e2, Math.sin(a) * (DISH_D / 2 + 0.25));
  const NR = 256;
  for (let i = 0; i < NR; i++) { const a = rimP(i / NR * 2 * Math.PI), b = rimP((i + 1) / NR * 2 * Math.PI); segs.push([...a.toArray(), ...b.toArray(), 0.12, 0]); }
  const NS = segs.length;
  const lineGeo = new THREE.InstancedBufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3));
  lineGeo.setIndex([0, 1, 2, 1, 3, 2]);
  {
    const A = new Float32Array(NS * 4), B = new Float32Array(NS * 4);
    segs.forEach((s, i) => { A.set([s[0], s[1], s[2], s[6]], 4 * i); B.set([s[3], s[4], s[5], s[7]], 4 * i); });
    lineGeo.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
    lineGeo.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
    lineGeo.instanceCount = NS;
  }
  const lineU = {
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uCamPos: { value: new THREE.Vector3() },
    uLamp: { value: LAMP.clone() }, uFeed: { value: new THREE.Vector3(...FEED) }, uAirC: U.uAirC,
  };
  const lineMat = new THREE.ShaderMaterial({
    uniforms: lineU, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      attribute vec4 iA, iB; uniform vec2 uRes; uniform float uS; uniform vec3 uCamPos;
      varying float vD, vHW, vI, vKind; varying vec3 vW;
      void main(){
        // pull the rim a little towards the camera so it wins against the bowl's own lip
        vec3 pa = iA.xyz, pb = iB.xyz;
        if (iB.w < 0.5) { pa += normalize(uCamPos - pa) * 0.6; pb += normalize(uCamPos - pb) * 0.6; }
        vec4 ca = projectionMatrix * viewMatrix * vec4(pa, 1.0), cb = projectionMatrix * viewMatrix * vec4(pb, 1.0);
        vec2 sa = (ca.xy / ca.w * 0.5 + 0.5) * uRes, sb = (cb.xy / cb.w * 0.5 + 0.5) * uRes;
        vec2 t = normalize(sb - sa + 1e-6), n = vec2(-t.y, t.x);
        float dist = mix(ca.w, cb.w, position.x);
        float wpx = iA.w * projectionMatrix[1][1] * 0.5 * uRes.y / dist;      // world width → px
        float hw = max(wpx, uS) * 0.5;                                          // ≥ 1 px wide
        vI = min(wpx / uS, 1.0);                                                // sub-pixel → dimmer
        vHW = hw; vKind = iB.w;
        float off = (hw + uS) * position.y;
        vD = off;
        vec2 s = mix(sa, sb, position.x) + n * off + t * (position.x * 2.0 - 1.0) * uS;
        vec4 c = mix(ca, cb, position.x);
        gl_Position = vec4((s / uRes * 2.0 - 1.0) * c.w, c.z, c.w);
        vW = mix(pa, pb, position.x);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLamp, uFeed, uAirC; varying float vD, vHW, vI, vKind; varying vec3 vW;
      void main(){
        float cov = clamp(vHW + 0.5 - abs(vD), 0.0, 1.0) * vI;
        vec3 c;
        if (vKind < 0.5) c = vec3(0.020, 0.025, 0.034) + uAirC * 0.008;   // the rim: sky on the lip
        else {
          c = vec3(0.00028, 0.00032, 0.00045);                            // the legs: silhouette
          float dl = length(vW - uLamp);
          c += uFeed * 0.06 / (1.0 + dl * dl * 0.25);
        }
        gl_FragColor = vec4(c * cov, cov);
      }`,
  });
  const lineMesh = new THREE.Mesh(lineGeo, lineMat); lineMesh.frustumCulled = false;
  const lineScene = new THREE.Scene(); lineScene.add(lineMesh);

  // ---- the lamp at R ----------------------------------------------------------------------------------
  const lamp = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes; uniform float uS, uI; uniform vec3 uFeed;
    void main(){
      vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS - vec2(${RX.toFixed(1)}, ${RY.toFixed(1)});
      float r2 = dot(px, px);
      float core = exp(-0.5 * r2 / (1.25 * 1.25)), halo = exp(-sqrt(r2) / 9.0) * 0.06;
      gl_FragColor = vec4(uFeed * uI * (core + halo) + vec3(1.0, 0.75, 0.7) * uI * 0.35 * exp(-0.5 * r2 / 0.36), 1.0);
    }`, { uRes: U.uRes, uS: U.uS, uI: { value: 2.0 }, uFeed: lineU.uFeed }, { blending: THREE.AdditiveBlending, transparent: true });

  return {
    render(shot, f) {
      const t = f.t;
      setCam(t);
      U.uInvVP.value.multiplyMatrices(skyCam.matrixWorld, skyCam.projectionMatrixInverse);
      U.uCamX.value = camX(t);
      lineU.uCamPos.value.copy(cam.position);
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.setRenderTarget(f.target); renderer.setClearColor(0x000000, 1); renderer.clear();
      sky.render(renderer, f.target);
      renderer.render(starScene, skyCam);
      hills.render(renderer, f.target);
      renderer.setRenderTarget(f.target); renderer.clearDepth();
      renderer.render(meshScene, cam);
      renderer.render(lineScene, cam);
      floor.render(renderer, f.target);
      lamp.render(renderer, f.target);
      renderer.autoClear = ac;
      renderer.setRenderTarget(f.target);
    },
    post() {
      return { exposure: 1.5, bloom: 0.7, bloomThreshold: 1.0, streak: 0.18, streakTint: [1.0, 0.45, 0.4], vignette: 0.26, grain: 0.04 };
    },
  };
}

function premult(m) {
  m.blending = THREE.CustomBlending; m.transparent = true;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendEquation = THREE.AddEquation;
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; m.blendEquationAlpha = THREE.AddEquation;
}
