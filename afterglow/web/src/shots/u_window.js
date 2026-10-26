// u_window — S39 窗 (S10-a, f5184–5255, 216.0 → 219.0 s). 85 mm.
//
// f5184 match cut from S38's cursor: the cursor's 24×64 px rectangle at R (x 722–746, y 508–572) is,
// one frame later, the glass of a lit window in a dark facade — same position, same size. It is the
// window of S04-e: every feature comes from timeline anchors.window (shared with l_carriers):
//   · 3:8 tall narrow glass (0.9 × 2.4 m) — here the glass is exactly the cursor's rectangle;
//   · a fixed transom 1/3 of the glass height below the head (drawn ≥ 4 px at the end of the push:
//     its true 3.75 cm would be 2 px, so it is held at 1/32 of the glass height — "graphic" weight);
//   · a light linen curtain gathered to the left jamb, its inner edge the diagonal that S04-e places
//     from (600, 138) to (780, 942) on the 720 px-wide glass, i.e. from (u 0, v 0.21) to (u 0.25,
//     v 0.63) in glass coordinates, continued down to the (S04-e off-screen) tie-back at v ≈ 0.80;
//   · a milky round desk-lamp shade (Ø 200/720 of the glass width) on the window's vertical centre
//     line, 0.42 of the glass height below the head — under the transom — 4000 K, a uniform face,
//     the brightest thing in the window.
//   Inside, barely: the desk edge under the lamp, a cup's silhouette, the corner of a bookshelf.
// f5184–5207 still; f5208–5255 a very slow push (easeInSine) centred on the window centre R: the glass
// grows 24×64 → 54×144 px (scale 1 → 2.25), reached exactly on f5255. The facade is a flat plane, so
// the push is an exact 2-D scale about R for it; the farther building scales less (parallax) and the
// sky does not scale.
// The facade is only a silhouette (a little darker than the sky, no material); sodium street glow
// rises from the bottom of the frame. Neighbouring windows are hashed room presets (dimmer, other
// colour temperatures); a few switch by hash, and two are coming on: f5220 a tungsten lamp warming up
// (2700 K), f5244 a cool LED ceiling fading up — someone else, elsewhere. No flicker, nothing that
// could read as a signal.
// Every edge is box-filtered analytically over the pixel footprint (no msaa needed).
import * as THREE from 'three';

const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
const v3 = a => `vec3(${a.map(v => v.toFixed(4)).join(',')})`;
const SODIUM = hex(0xFFB45A), LED = hex(0xE8F0FF);
const easeInSine = u => 1 - Math.cos(u * Math.PI / 2);

export async function create(ctx) {
  const { W, H, kit, renderer, timeline } = ctx;
  const S = H / 1080;
  const shot = timeline.shots.find(s => s.module === 'u_window') || { frames: [5184, 5256], params: {} };
  const P = shot.params || {};
  const [F0, F1] = shot.frames;
  const PUSH = P.push || [5208, 5256];
  const s0 = (P.startPx || [24, 64])[0], s1 = (P.endPx || [54, 144])[0];
  const NB = P.neighbourOn || [5220, 5244];
  const R = timeline.anchors.R;                                   // (734, 540): window centre
  // ---- the shared window (anchors.window) in glass coordinates u (→ right), v (↓ from the head) ----
  const AW = timeline.anchors.window;
  const e = AW.S04e;
  const gw = e.glass[1] - e.glass[0], gh = e.bottom - e.top;
  const edgeA = [(e.curtainEdge[0][0] - e.glass[0]) / gw, (e.curtainEdge[0][1] - e.top) / gh];
  const edgeB = [(e.curtainEdge[1][0] - e.glass[0]) / gw, (e.curtainEdge[1][1] - e.top) / gh];
  const frameW = (e.frame[0][1] - e.frame[0][0]) / gw;            // aluminium jamb, in glass widths
  const lampR = 0.5 * e.lampDiameter / gw;                         // shade radius, in glass widths
  const GW = s0, GH = s0 * AW.ratio[1] / AW.ratio[0];              // glass at scale 1: 24 × 64 px
  const G0 = [R[0] - GW / 2, R[1] - GH / 2];                       // (722, 508)
  // push: frame-exact scale about R, 1 → s1/s0 reached on the last frame of the push
  const scaleAt = fr => 1 + (s1 / s0 - 1) * easeInSine(Math.min(1, Math.max(0, (fr - PUSH[0]) / (PUSH[1] - 1 - PUSH[0]))));

  const U = {
    uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uFr: { value: 0 }, uScale: { value: 1 },
  };
  const pass = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes; uniform float uS, uFr, uScale;
    const vec3 SODIUM = ${v3(SODIUM)};
    const vec3 LEDC = ${v3(LED)};
    const vec2 RP = vec2(${R[0].toFixed(1)}, ${R[1].toFixed(1)});
    const vec4 GLASS = vec4(${G0[0].toFixed(3)}, ${G0[1].toFixed(3)}, ${(G0[0] + GW).toFixed(3)}, ${(G0[1] + GH).toFixed(3)});
    const float TRANSOM = ${AW.transomFromTop.toFixed(5)};
    const float LAMPV = ${AW.lampFromTop.toFixed(5)};
    const float LAMPR = ${lampR.toFixed(5)};
    const float FRAMEW = ${frameW.toFixed(5)};
    const vec2 EDGEA = vec2(${edgeA[0].toFixed(5)}, ${edgeA[1].toFixed(5)});
    const vec2 EDGEB = vec2(${edgeB[0].toFixed(5)}, ${edgeB[1].toFixed(5)});
    const float NB1 = ${NB[0].toFixed(1)}, NB2 = ${NB[1].toFixed(1)};
    float FW;                                              // pixel footprint in facade px

    float cov1(float a, float b, float x){ return clamp((min(x + 0.5 * FW, b) - max(x - 0.5 * FW, a)) / FW, 0.0, 1.0); }
    float covR(vec4 r, vec2 p){ return cov1(r.x, r.z, p.x) * cov1(r.y, r.w, p.y); }
    // signed-distance → coverage (d > 0 inside), d in facade px
    float covD(float d){ return clamp(d / FW + 0.5, 0.0, 1.0); }
    float hsh(vec2 c, float s){ return hash13(vec3(c, s * 7.0 + 3.0)); }
    vec3 kel(float T){ vec3 b = blackbody(T); return b / max(1e-3, max(b.r, max(b.g, b.b))); }

    // the city sky (screen space, does not scale): blue-black above, sodium skyglow towards the horizon
    vec3 sky(vec2 q){
      vec3 top = vec3(0.0085, 0.0092, 0.0150), hor = vec3(0.052, 0.033, 0.019);
      vec3 c = mix(top, hor, smoothstep(60.0, 820.0, q.y));
      float cl = fbm(vec2(q.x / 560.0, q.y / 130.0) + vec2(3.0, 1.0), 4);
      c += vec3(0.010, 0.0068, 0.0042) * smoothstep(0.42, 0.8, cl) * smoothstep(60.0, 460.0, q.y);
      return c;
    }

    // ---------------- our window (glass coordinates uv; gp = facade px inside the glass) ----------------
    // curtain inner edge u = edge(v): the S04-e diagonal down to the tie-back, then gathered back below it
    const float TIEV = 0.80;
    float curtainEdge(float v){
      float k = (EDGEB.x - EDGEA.x) / (EDGEB.y - EDGEA.y);
      float e = EDGEA.x + k * (v - EDGEA.y);
      float tie = EDGEA.x + k * (TIEV - EDGEA.y);
      if (v > TIEV) e = tie - 0.55 * (v - TIEV);               // below the tie the fabric falls back
      return e;
    }
    vec3 ourWindow(vec2 uv, vec2 sz, out float lampMask){
      vec3 K = kel(4000.0);
      float aspect = sz.x / sz.y;                             // 3/8
      float FU = FW / sz.x, FV = FW / sz.y;                   // footprint in u / v units
      // lamp shade: a milky round disc, uniform face, a touch brighter at its centre-top
      vec2 lc = vec2(0.5, LAMPV);
      vec2 dl = vec2(uv.x - lc.x, (uv.y - lc.y) / aspect);    // isotropic, in glass widths
      float rl = length(dl);
      float soft = max(FU, 0.012);
      float shade = clamp((LAMPR - rl) / soft + 0.5, 0.0, 1.0);
      lampMask = shade;
      // the back wall, lit by the lamp (inverse-square-ish falloff), shadowed below the desk top
      float deskV = LAMPV + 1.25 * LAMPR / aspect * 0.5 + 0.05;   // desk top a little below the shade
      float rw = length(vec2(uv.x - 0.5, (uv.y - lc.y) * 1.2 / aspect));
      float wall = 0.035 + 0.40 / (1.0 + pow(rw / 0.30, 2.0));
      wall *= mix(1.0, 0.86, smoothstep(0.2, 0.0, uv.y));      // ceiling falls off
      vec3 c = K * vec3(1.0, 0.96, 0.92) * wall;
      // desk: a thin lit top edge, dark front below it; the lamp's stem and base on it
      float deskTop = covD((uv.y - deskV) * sz.y);
      float under = smoothstep(deskV, deskV + 0.12, uv.y);
      c *= mix(1.0, 0.18 + 0.12 * (1.0 - under), deskTop);
      float edgeLit = cov1(deskV * sz.y, deskV * sz.y + max(0.9, 0.010 * sz.y), uv.y * sz.y);
      c += K * 0.20 * edgeLit * exp(-pow((uv.x - 0.5) / 0.35, 2.0));
      float stem = cov1((0.5 - 0.012) * sz.x, (0.5 + 0.012) * sz.x, uv.x * sz.x) * cov1((lc.y + 0.02) * sz.y, deskV * sz.y, uv.y * sz.y);
      c = mix(c, K * 0.04, stem * 0.85);
      // a cup on the desk (right of the lamp): a silhouette against the lit wall
      vec2 cupC = vec2(0.73, deskV - 0.022);
      float cup = cov1((cupC.x - 0.045) * sz.x, (cupC.x + 0.045) * sz.x, uv.x * sz.x) * cov1((cupC.y - 0.022) * sz.y, deskV * sz.y, uv.y * sz.y);
      c = mix(c, K * 0.03, cup * 0.9);
      // the corner of a bookshelf at the right: dark uprights, faintly lit spines between the shelves
      float shelfX = 0.86;
      float inShelf = cov1(shelfX * sz.x, 2.0 * sz.x, uv.x * sz.x) * cov1(0.12 * sz.y, 0.95 * sz.y, uv.y * sz.y);
      float rows = fract(uv.y * 9.0);
      float board = smoothstep(0.0, 0.10, rows) * smoothstep(0.30, 0.14, rows);
      float spine = 0.5 + 0.5 * sin(uv.x * 260.0 + floor(uv.y * 9.0) * 2.3);
      vec3 shelf = K * vec3(1.0, 0.86, 0.72) * (0.020 + 0.05 * spine * (1.0 - board)) * (0.5 + 0.5 * wall / 0.3);
      c = mix(c, shelf, inShelf);
      // curtain: translucent linen, lamp light coming through and catching the folds; inner edge rim
      float ce = curtainEdge(uv.y);
      float inC = covD((ce - uv.x) * sz.x) * smoothstep(EDGEA.y - 0.05, EDGEA.y + 0.02, uv.y + 0.03 * (1.0 - uv.x));
      float relx = clamp(uv.x / max(ce, 0.02), 0.0, 1.0);    // 0 at the jamb, 1 at the edge
      float folds = 0.62 + 0.38 * sin(relx * 18.0 + uv.y * 4.0) * (0.6 + 0.4 * sin(relx * 7.0 - 1.3));
      float lampSide = 0.55 + 0.45 * relx;                     // the side towards the lamp is lit more
      vec3 linen = kel(3300.0) * vec3(1.0, 0.93, 0.80) * 0.052 * folds * lampSide * (0.8 + 0.4 / (1.0 + pow(rw / 0.35, 2.0)));
      float rim = exp(-pow((ce - uv.x) * sz.x / max(0.6, 0.012 * sz.x), 2.0)) * step(uv.x, ce + 0.01);
      linen += K * 0.035 * rim;
      c = mix(c, linen, inC);
      // the transom (fixed bar, aluminium): drawn at 1/32 of the glass height
      float tb = sz.y / 32.0;
      float tr = cov1(TRANSOM * sz.y - 0.5 * tb, TRANSOM * sz.y + 0.5 * tb, uv.y * sz.y);
      c = mix(c, K * 0.022 + vec3(0.002), tr);
      // the lamp shade over everything behind it (it stands in the room in front of the curtain's edge)
      vec3 lamp = K * 1.32 * (1.0 + 0.06 * (1.0 - smoothstep(0.0, LAMPR, length(dl - vec2(0.0, -0.25 * LAMPR)))));
      c = mix(c, lamp, shade);
      // glass: a faint cool reflection of the sky (≈ 4 %), stronger towards the head
      c += vec3(0.0055, 0.0068, 0.0098) * (0.7 + 0.6 * (1.0 - uv.y));
      return c;
    }

    // ---------------- neighbours: hashed room presets ----------------
    vec3 room(vec2 uv, float type, float h1, float h2, float lev, vec3 K){
      vec3 c;
      if (type < 1.0) {                                    // a lamp low in a corner
        vec2 lp = vec2(h1 < 0.5 ? 0.2 : 0.8, 0.82);
        float g = exp(-dot((uv - lp) * vec2(1.0, 0.45), (uv - lp) * vec2(1.0, 0.45)) / 0.07);
        c = K * (0.12 + 1.0 * g) * (0.8 + 0.2 * uv.y);
      } else if (type < 2.0) {                             // ceiling light: brighter near the top
        c = K * (0.55 + 0.45 * smoothstep(0.9, 0.0, uv.y)) * (0.85 + 0.15 * sin(uv.x * 3.1));
      } else if (type < 3.0) {                             // drawn curtain: light through fabric, soft folds
        float folds = 0.78 + 0.22 * sin(uv.x * 6.2831 * (2.0 + h1 * 2.0) + h2 * 6.0);
        c = K * vec3(1.0, 0.80, 0.58) * folds * (0.55 + 0.25 * smoothstep(1.0, 0.2, uv.y));
      } else if (type < 4.0) {                             // half-drawn curtain
        float e = 0.35 + 0.35 * h1;
        float side = h2 < 0.5 ? uv.x : 1.0 - uv.x;
        float sh = smoothstep(e - 0.12, e + 0.12, side);
        vec2 lp = vec2(h2 < 0.5 ? 0.8 : 0.2, 0.8);
        float g = exp(-dot(uv - lp, uv - lp) / 0.18);
        c = K * mix(vec3(0.40, 0.28, 0.18), vec3(1.0), sh) * (0.35 + 0.7 * g);
      } else if (type < 5.0) {                             // blinds
        float y = uv.y * 16.0;
        float sl = 0.5 + 0.5 * smoothstep(0.25, 0.55, abs(fract(y) - 0.5) * 2.0);
        c = K * (0.45 + 0.55 * sl) * (0.6 + 0.4 * smoothstep(1.0, 0.3, uv.y));
      } else if (type < 6.0) {                             // a cool LED room
        c = LEDC * (0.45 + 0.3 * smoothstep(1.0, 0.0, uv.y));
      } else {                                             // a TV deep in a dark room: dim, steady blue
        c = vec3(0.55, 0.66, 1.0) * 0.30 * (0.6 + 0.4 * exp(-pow((uv.x - 0.5) / 0.5, 2.0))) * (0.5 + 0.5 * smoothstep(0.3, 0.8, uv.y));
      }
      float rev = (0.72 + 0.28 * smoothstep(0.0, 0.22, min(uv.x, 1.0 - uv.x))) * (0.8 + 0.2 * smoothstep(0.0, 0.15, uv.y));
      return c * lev * rev;
    }
    float sash(vec2 q, vec2 sz, float h){
      float b = sz.x / 24.0;
      float m = 1.0;
      m *= 1.0 - (1.0 - cov1(b, sz.x - b, q.x)) * 0.85;
      m *= 1.0 - (1.0 - cov1(b, sz.y - b, q.y)) * 0.85;
      float ty = sz.y * (h < 0.6 ? 0.26 : 0.40);
      m *= 1.0 - 0.8 * cov1(ty, ty + sz.y / 40.0, q.y);
      if (h > 0.78) m *= 1.0 - 0.8 * cov1(sz.x * 0.5 - sz.x / 48.0, sz.x * 0.5 + sz.x / 48.0, q.x);
      return m;
    }
    // a neighbour's state: hashed preset + a few hashed switchings + the two scripted ones
    vec4 neighbour(vec2 p, vec4 r, vec2 id, float bld, out float lit, out vec3 litK){
      vec2 sz = r.zw - r.xy, q = p - r.xy, uv = q / sz;
      float h0 = hsh(id, bld), h1 = hsh(id, bld + 1.0), h2 = hsh(id, bld + 2.0), h3 = hsh(id, bld + 3.0), h4 = hsh(id, bld + 4.0);
      float on = step(h0, bld < 0.5 ? 0.21 : 0.17);
      float type = floor(h1 * 5.0);
      if (h1 > 0.93) type = 5.0;
      if (h1 > 0.965) type = 6.0;
      if (bld > 0.5 && h3 < 0.18) type = 5.0;
      float lev = 0.06 + 0.24 * h2 * h2 + 0.10 * h3;
      vec3 K = kel(mix(2100.0, 3100.0, h3 * h3));
      // a few windows change state at a hashed moment (~4 %); never near our window
      if (h4 < 0.045 && length(id) > 2.5) {
        float tf = mix(${F0.toFixed(1)}, ${F1.toFixed(1)}, hsh(id, bld + 5.0));
        float sw = step(tf, uFr);
        on = h0 < 0.5 ? sw : 1.0 - sw;
      }
      if (bld < 0.5) {
        if (id == vec2(2.0, -1.0)) {                       // f5220: a tungsten lamp warming up (2700 K)
          float a = clamp((uFr - NB1 + 1.0) / 6.0, 0.0, 1.0);
          on = a * a * (3.0 - 2.0 * a); type = 0.0; lev = 0.30; K = kel(mix(1700.0, 2700.0, a));
        } else if (id == vec2(-3.0, 1.0)) {                // f5244: a cool LED ceiling fading up
          float a = clamp((uFr - NB2 + 1.0) / 8.0, 0.0, 1.0);
          on = a * a; type = 5.0; lev = 0.36;
        } else if (id == vec2(5.0, 0.0)) {                 // someone switches off (between the two)
          on = 1.0 - step(5236.0, uFr); type = 3.0; lev = 0.26;
        } else if (id == vec2(-2.0, -2.0)) {
          on = 1.0 - step(5197.0, uFr); type = 2.0; lev = 0.20;
        } else if (abs(id.x) + abs(id.y) < 1.5 || id == vec2(1.0, 1.0) || id == vec2(-1.0, -1.0) || id == vec2(1.0, -1.0) || id == vec2(-1.0, 1.0)) {
          on = 0.0;                                        // our window stands alone in its little dark
        }
      }
      float c = covR(r, p);
      lit = on * lev; litK = type > 4.5 ? LEDC : K;
      if (c <= 0.0 || on <= 0.0) return vec4(0.0);
      vec3 col = room(uv, type, h1, h2, lev, K) * on * sash(q, sz, h3);
      return vec4(col * c, c);
    }

    void main(){
      vec2 q = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;   // screen, 1080p px, top-left origin
      float s1 = uScale, s2 = 1.0 + (uScale - 1.0) * 0.55;            // facade / the farther building
      vec2 p = RP + (q - RP) / s1;                                     // facade coords (scale 1 = f5184)
      vec2 p2 = RP + (q - RP) / s2;
      vec3 col = sky(q);
      // street glow: part on the facade (moves with it), part sodium air between us and it (screen)
      float streetF = exp(-(940.0 - p.y) / 210.0);
      float streetQ = exp(-(942.0 - q.y) / 150.0);

      // ---- building 2 (farther, right): roof at 372 ----
      FW = 1.0 / (uS * s2);
      float b2 = cov1(1262.0, 99999.0, p2.x) * cov1(372.0, 99999.0, p2.y);
      vec3 skyR2 = sky(vec2(q.x, RP.y + (342.0 - RP.y) * s2));
      vec3 wall2 = min(skyR2 * 0.52 + SODIUM * 0.003 * exp(-(940.0 - p2.y) / 210.0), skyR2 * 0.74);
      col = mix(col, wall2, b2);
      if (b2 > 0.0 && p2.x >= 1262.0 && p2.y > 386.0) {
        float i = floor((p2.x - 1286.0 + 15.0) / 46.0);
        float j = floor((p2.y - 398.0 + 7.0) / 52.0);
        vec4 r = vec4(1286.0 + 46.0 * i, 398.0 + 52.0 * j, 1301.0 + 46.0 * i, 436.0 + 52.0 * j);
        if (r.x > 1268.0) {
          float lit; vec3 lk;
          vec4 w = neighbour(p2, r, vec2(i, j), 1.0, lit, lk);
          w.rgb *= 0.8;
          col = col * (1.0 - w.a) + w.rgb;
          vec2 dq = max(abs(p2 - 0.5 * (r.xy + r.zw)) - 0.5 * (r.zw - r.xy), 0.0);
          col += lk * lit * 0.012 * exp(-length(dq) / 6.0) * step(0.01, length(dq));
        }
      }

      // ---- building 1 (ours): x < 1262, roof at 222 with a water tank and a lift housing ----
      FW = 1.0 / (uS * s1);
      float roof = 222.0;
      float b1 = (1.0 - cov1(1262.0, 99999.0, p.x)) * cov1(roof, 99999.0, p.y);
      b1 = max(b1, covR(vec4(392.0, 160.0, 448.0, 207.0), p));                       // tank body
      float capW = mix(0.0, 28.0, clamp((p.y - 144.0) / 16.0, 0.0, 1.0));
      b1 = max(b1, cov1(420.0 - capW, 420.0 + capW, p.x) * cov1(144.0, 160.0, p.y)); // conical cap
      for (int k = 0; k < 3; k++) b1 = max(b1, covR(vec4(395.0 + 23.0 * float(k), 206.0, 398.0 + 23.0 * float(k), 223.0), p));
      b1 = max(b1, covR(vec4(904.0, 186.0, 1012.0, 223.0), p));                      // lift housing
      b1 = max(b1, covR(vec4(958.5, 112.0, 960.5, 187.0), p));                        // mast
      b1 = max(b1, covR(vec4(1110.0, 208.0, 1160.0, 223.0), p));                      // a/c units
      // the wall: referenced to the sky ABOVE the roofline (not the brighter horizon behind it), a trace
      // of street glow at the bottom, always a few code values under that sky (silhouette, no material)
      vec3 skyR1 = sky(vec2(q.x, RP.y + (roof - 30.0 - RP.y) * s1));
      vec3 wall1 = min(skyR1 * 0.50 + SODIUM * 0.0050 * streetF, skyR1 * 0.70 + SODIUM * 0.0020 * streetF);
      col = mix(col, wall1, b1);

      if (b1 > 0.0 && p.x < 1262.0 && p.y > roof + 20.0) {
        // window grid: pairs 64 px apart, pair pitch 144 px; floors 80 px; ours = (0, 0) = the glass at R
        float m = floor((p.x - GLASS.x + 40.0) / 144.0);
        float lx = p.x - (GLASS.x + 144.0 * m);
        float sd = lx >= 44.0 ? 1.0 : 0.0;
        float j = floor((p.y - GLASS.y + 8.0) / 80.0);
        vec2 id = vec2(2.0 * m + sd, j);
        vec4 r = vec4(GLASS.x + 144.0 * m + 64.0 * sd, GLASS.y + 80.0 * j, GLASS.z + 144.0 * m + 64.0 * sd, GLASS.w + 80.0 * j);
        if (r.z < 1258.0 && r.y > roof + 30.0) {
          vec2 dq = max(abs(p - 0.5 * (r.xy + r.zw)) - 0.5 * (r.zw - r.xy), 0.0);
          float dd = length(dq);
          if (id == vec2(0.0)) {
            vec2 sz = r.zw - r.xy;
            float c = covR(r, p);
            // the aluminium frame just outside the glass: catches a little of the room's light
            float fw = FRAMEW * sz.x;
            float fr = covR(vec4(r.x - fw, r.y - fw, r.z + fw, r.w + fw), p) - c;
            vec3 K = kel(4000.0);
            col = mix(col, K * 0.012 + vec3(0.002), max(fr, 0.0));
            if (c > 0.0) {
              float lm;
              vec3 w = ourWindow((p - r.xy) / sz, sz, lm);
              col = col * (1.0 - c) + w * c;
            }
            // light spilling onto the reveal and sill, and the air just around the glass
            float sill = covR(vec4(r.x - fw - 1.0, r.w + fw, r.z + fw + 1.0, r.w + fw + 1.6), p);
            col += K * 0.05 * sill;
            col += K * 0.030 * exp(-dd / 6.0) * step(0.01, dd) * (1.0 - fr);
          } else {
            float lit; vec3 lk;
            vec4 w = neighbour(p, r, id, 0.0, lit, lk);
            col = col * (1.0 - w.a) + w.rgb;
            float sill = covR(vec4(r.x - 1.0, r.w + 1.0, r.z + 1.0, r.w + 2.4), p);
            col += lk * 0.03 * lit * sill;
            col += lk * lit * 0.018 * exp(-dd / 6.0) * step(0.01, dd);
          }
        }
      }
      // the night air in front of everything: sodium haze rising from the street below the frame
      col += SODIUM * (0.0065 * streetQ * streetQ + 0.0025 * streetF);
      gl_FragColor = vec4(col, 1.0);
    }`, U);

  return {
    render(shot, f) {
      const fr = Math.round(f.t * 24 * 1000) / 1000;
      U.uFr.value = fr;
      U.uScale.value = scaleAt(fr);
      pass.render(renderer, f.target);
    },
    post(shot, f) {
      // the modern lamp / window optics (visual-changes §1.3): wide, faint bloom, no anamorphic streak
      return { bloom: 0.35, bloomRadius: 1.2, streak: 0.0, bloomThreshold: 1.0 };
    },
    _debug: { scaleAt },
  };
}
