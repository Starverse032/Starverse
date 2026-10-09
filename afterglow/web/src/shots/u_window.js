// u_window — S39 窗 (216.0 → 219.0, f5184–5255). 85 mm, locked, a still frame.
//
// Match cut ③ from S38's cursor: on f5184 our window IS the cursor — exactly 24×64 px at R
// (x 722–746, y 508–572), CURSOR #F2EEE4 at HDR 2.0, the same bloom and a short streak. Over the first
// half second the rectangle becomes a window: the colour warms to WINDOW #FFC98A, a desk lamp's
// radial gradient settles in its lower-left corner, a curtain's soft vertical shadow and the thin
// sash bars appear, and its level eases 2.0 → 1.6 over the shot.
//
// The facade is a pure silhouette (one fullscreen shader, no geometry, no material): the building
// is only a little darker than the city's sky; what you see is light — windows (3–5 room presets
// chosen by hash: desk lamp, ceiling light, curtain, half-drawn curtain, blinds, a cool LED room,
// a TV's blue flicker deep in a room), a sill catching the light below some of them, and the
// sodium glow of the street lamps rising from below. A second, farther building at the right
// (aerial perspective: closer to the sky's tone), a roofline with a water tank and a lift housing
// against the skyglow. A few neighbouring windows go on and off during the 3 s — one comes on
// with a lamp's warm-up, one with a fluorescent tube's stutter: someone else is asking too.
// Every edge is box-filtered analytically over the pixel footprint (no msaa needed).
import * as THREE from 'three';

const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [srgb(((h >> 16) & 255) / 255), srgb(((h >> 8) & 255) / 255), srgb((h & 255) / 255)];
const v3 = a => `vec3(${a.map(v => v.toFixed(4)).join(',')})`;
const CURSOR = hex(0xF2EEE4), WINDOW = hex(0xFFC98A), SODIUM = hex(0xFFB45A);
const T0 = 216.0;

export async function create(ctx) {
  const { W, H, kit, renderer } = ctx;
  const S = H / 1080;
  const U = { uRes: { value: new THREE.Vector2(W, H) }, uS: { value: S }, uT: { value: 0 }, uLt: { value: 0 } };
  const pass = kit.fullscreen(/* glsl */ `
    uniform vec2 uRes; uniform float uS, uT, uLt;
    const vec3 CURSOR = ${v3(CURSOR)};
    const vec3 WINDOW = ${v3(WINDOW)};
    const vec3 SODIUM = ${v3(SODIUM)};
    float FW;                                              // pixel footprint in 1080p px

    // exact box-filter coverage of [a, b] by the pixel centred at x
    float cov1(float a, float b, float x){ return clamp((min(x + 0.5 * FW, b) - max(x - 0.5 * FW, a)) / FW, 0.0, 1.0); }
    float covR(vec4 r, vec2 p){ return cov1(r.x, r.z, p.x) * cov1(r.y, r.w, p.y); }   // r = x0, y0, x1, y1
    float hsh(vec2 c, float s){ return hash13(vec3(c, s * 7.0 + 3.0)); }

    // the city sky: deep blue-black above, sodium-brown skyglow towards the horizon, faint lit cloud
    vec3 sky(vec2 p){
      vec3 top = vec3(0.0105, 0.0110, 0.0175), hor = vec3(0.060, 0.038, 0.022);
      vec3 c = mix(top, hor, smoothstep(0.0, 760.0, p.y));
      float cl = fbm(vec2(p.x / 520.0, p.y / 120.0) + vec2(3.0, 1.0), 4);
      c += vec3(0.012, 0.008, 0.005) * smoothstep(0.4, 0.8, cl) * smoothstep(40.0, 420.0, p.y);
      return c;
    }

    // ---- room presets: uv in the window (0,0 = top-left), returns linear HDR ---------------------
    vec3 room(vec2 uv, float type, float h1, float h2, float lev, vec3 K){
      vec3 c;
      if (type < 1.0) {                                    // desk lamp in a lower corner
        vec2 lp = vec2(h1 < 0.5 ? 0.18 : 0.82, 0.86);
        float g = exp(-dot((uv - lp) * vec2(1.0, 0.45), (uv - lp) * vec2(1.0, 0.45)) / 0.07);
        c = K * (0.10 + 1.15 * g) * (0.8 + 0.2 * uv.y);
      } else if (type < 2.0) {                             // ceiling light: brighter near the top
        c = K * (0.55 + 0.45 * smoothstep(0.9, 0.0, uv.y)) * (0.85 + 0.15 * sin(uv.x * 3.1));
      } else if (type < 3.0) {                             // drawn curtain: light through fabric, soft folds
        float folds = 0.78 + 0.22 * sin(uv.x * 6.2831 * (2.0 + h1 * 2.0) + h2 * 6.0);
        c = K * vec3(1.0, 0.82, 0.62) * folds * (0.55 + 0.25 * smoothstep(1.0, 0.2, uv.y));
      } else if (type < 4.0) {                             // half-drawn curtain: lamp + a soft vertical shadow
        float e = 0.35 + 0.35 * h1;
        float side = h2 < 0.5 ? uv.x : 1.0 - uv.x;
        float sh = smoothstep(e - 0.12, e + 0.12, side);
        vec2 lp = vec2(h2 < 0.5 ? 0.8 : 0.2, 0.8);
        float g = exp(-dot(uv - lp, uv - lp) / 0.18);
        c = K * mix(vec3(0.42, 0.30, 0.20), vec3(1.0), sh) * (0.35 + 0.7 * g);
      } else if (type < 5.0) {                             // blinds: slats, light between them
        float y = uv.y * 64.0 / 4.0;                       // 4 px pitch
        float sl = 0.5 + 0.5 * smoothstep(0.25, 0.55, abs(fract(y) - 0.5) * 2.0);
        c = K * (0.45 + 0.55 * sl) * (0.6 + 0.4 * smoothstep(1.0, 0.3, uv.y));
      } else if (type < 6.0) {                             // a cool LED room (the odd one out)
        c = vec3(0.86, 0.91, 1.0) * (0.45 + 0.3 * smoothstep(1.0, 0.0, uv.y));
      } else {                                             // a TV deep in the room: dim blue, flickering
        float fl = 0.65 + 0.35 * vnoise(vec2(uT * 9.0, h1 * 40.0)) * vnoise(vec2(uT * 23.0, h2 * 40.0) + 3.0);
        c = vec3(0.55, 0.66, 1.0) * 0.32 * fl * (0.6 + 0.4 * exp(-pow((uv.x - 0.5) / 0.5, 2.0)));
      }
      // the reveal: light falls off towards the jambs and the head of the window
      float rev = (0.72 + 0.28 * smoothstep(0.0, 0.22, min(uv.x, 1.0 - uv.x))) * (0.8 + 0.2 * smoothstep(0.0, 0.15, uv.y));
      return c * lev * rev;
    }
    // sash: a 1.5 px frame and a transom bar a quarter down (some windows have a central mullion too)
    float sash(vec2 q, vec2 sz, float h){
      float m = 1.0;
      float b = 1.5;
      m *= 1.0 - (1.0 - cov1(b, sz.x - b, q.x)) * 0.9;
      m *= 1.0 - (1.0 - cov1(b, sz.y - b, q.y)) * 0.9;
      float ty = floor(sz.y * (h < 0.6 ? 0.26 : 0.34));
      m *= 1.0 - 0.85 * cov1(ty, ty + 1.5, q.y);
      if (h > 0.78) m *= 1.0 - 0.85 * cov1(sz.x * 0.5 - 0.75, sz.x * 0.5 + 0.75, q.x);
      return m;
    }
    // colour temperature of a lamp → normalised warm tint
    vec3 kel(float T){ vec3 b = blackbody(T); return b / max(1e-3, max(b.r, max(b.g, b.b))); }

    // one window: state from a hash, plus a few scripted neighbours that switch during the shot
    // returns colour (premultiplied by coverage) in .rgb and coverage in .a
    vec4 windowAt(vec2 p, vec4 r, vec2 id, float bld, out float lit){
      vec2 sz = r.zw - r.xy;
      vec2 q = p - r.xy;
      vec2 uv = q / sz;
      float h0 = hsh(id, bld), h1 = hsh(id, bld + 1.0), h2 = hsh(id, bld + 2.0), h3 = hsh(id, bld + 3.0);
      float on = step(h0, bld < 0.5 ? 0.2 : 0.17);
      // presets: mostly warm rooms (lamp, ceiling, curtain, half curtain, blinds); a rare LED room or TV
      float type = floor(h1 * 5.0);
      if (h1 > 0.93) type = 5.0;
      if (h1 > 0.965) type = 6.0;
      if (bld > 0.5 && h3 < 0.18) type = 5.0;            // the far building has a few office LEDs
      float lev = 0.10 + 0.42 * h2 * h2 + 0.16 * h3;
      vec3 K = kel(mix(2200.0, 3300.0, h3 * h3));
      // scripted switches near R (building 0 only): ids are (column, row) relative to our window
      if (bld < 0.5) {
        if (id == vec2(2.0, -1.0)) {                       // a lamp comes on at 216.75 (3-frame warm-up)
          on = smoothstep(216.75, 216.75 + 3.0 / 24.0, uT); type = 0.0; lev = 0.55; K = kel(2500.0);
        } else if (id == vec2(-3.0, 1.0)) {                // a fluorescent tube stutters on at 217.90
          float f = floor((uT - 217.9) * 24.0);
          on = f < 0.0 ? 0.0 : (f < 2.0 ? 0.7 : (f < 5.0 ? 0.0 : (f < 6.0 ? 0.5 : (f < 8.0 ? 0.08 : 1.0))));
          type = 1.0; lev = 0.42; K = vec3(0.85, 0.92, 1.0);
        } else if (id == vec2(5.0, 0.0)) {                 // someone switches off at 218.35
          on = 1.0 - step(218.35, uT); type = 3.0; lev = 0.5;
        } else if (id == vec2(-1.0, 2.0)) {                // and another lamp at 218.60
          on = smoothstep(218.6, 218.6 + 2.0 / 24.0, uT); type = 3.0; lev = 0.38; K = kel(2700.0);
        } else if (id == vec2(1.0, 0.0) || id == vec2(-1.0, 0.0) || id == vec2(0.0, -1.0) || id == vec2(0.0, 1.0)) {
          on = 0.0;                                        // our window stands alone in its little dark
        }
      }
      float c = covR(r, p);
      lit = on * lev;
      if (c <= 0.0) return vec4(0.0);
      vec3 col;
      if (on > 0.0) col = room(uv, type, h1, h2, lev, K) * on * sash(q, sz, h3) + vec3(0.002, 0.0016, 0.0012) * (1.0 - on);
      else {
        // unlit glass: a faint, cool reflection of the skyglow, darker than the wall
        col = vec3(-1.0);                                 // marker: caller keeps the wall, slightly darkened

      }
      if (col.r < 0.0) return vec4(0.0, 0.0, 0.0, -c);
      return vec4(col * c, c);
    }

    void main(){
      FW = 1.0 / uS;
      vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uS;   // 1080p px, top-left origin
      vec3 skyc = sky(p);
      vec3 col = skyc;
      // street lamps below: sodium glow rising from the bottom of the frame
      float street = exp(-(942.0 - p.y) / 170.0);

      // ---- building 1 (ours): x < 1262, roof at 222 with a water tank and a lift housing -------------
      float roof = 222.0;
      float b1 = (1.0 - cov1(1262.0, 99999.0, p.x)) * cov1(roof, 99999.0, p.y);
      // rooftop silhouettes
      b1 = max(b1, covR(vec4(392.0, 160.0, 448.0, 207.0), p));                       // tank body
      float capW = mix(0.0, 28.0, clamp((p.y - 144.0) / 16.0, 0.0, 1.0));            // conical cap
      b1 = max(b1, cov1(420.0 - capW, 420.0 + capW, p.x) * cov1(144.0, 160.0, p.y));
      for (int k = 0; k < 3; k++) b1 = max(b1, covR(vec4(395.0 + 23.0 * float(k), 206.0, 398.0 + 23.0 * float(k), 223.0), p));
      b1 = max(b1, covR(vec4(904.0, 186.0, 1012.0, 223.0), p));                      // lift housing
      b1 = max(b1, covR(vec4(958.5, 112.0, 960.5, 187.0), p));                        // mast
      b1 = max(b1, covR(vec4(1110.0, 208.0, 1160.0, 223.0), p));                      // a/c units
      // a pure silhouette: the wall is referenced to the sky seen ABOVE the roofline (not the brighter
      // horizon sky behind it), with only a trace of street glow at the bottom, and clamped a few code
      // values under that sky everywhere (no material, no window grid)
      vec3 skyR1 = sky(vec2(p.x, roof - 30.0));
      vec3 wall1 = min(skyR1 * 0.48 + SODIUM * 0.0045 * street, skyR1 * 0.66);

      // ---- building 2 (farther, right): roof at 372 ----------------------------------------------------
      float b2 = cov1(1262.0, 99999.0, p.x) * cov1(372.0, 99999.0, p.y);
      vec3 skyR2 = sky(vec2(p.x, 342.0));
      vec3 wall2 = min(skyR2 * 0.50 + SODIUM * 0.003 * street, skyR2 * 0.72);   // farther: a little closer to the sky

      col = mix(col, wall2, b2 * (1.0 - b1));
      col = mix(col, wall1, b1);

      float glowAcc = 0.0; vec3 glowCol = vec3(0.0);
      // building 1 windows: pairs 64 px apart, pair pitch 144 px; floors 80 px; ours = (0, 0) at (722, 508)
      if (p.x < 1262.0 && p.y > roof + 20.0) {
        float m = floor((p.x - 722.0 + 40.0) / 144.0);
        float lx = p.x - (722.0 + 144.0 * m);
        float s = lx >= 44.0 ? 1.0 : 0.0;
        float j = floor((p.y - 508.0 + 8.0) / 80.0);
        vec2 id = vec2(2.0 * m + s, j);
        vec4 r = vec4(722.0 + 144.0 * m + 64.0 * s, 508.0 + 80.0 * j, 746.0 + 144.0 * m + 64.0 * s, 572.0 + 80.0 * j);
        if (r.z < 1258.0 && r.y > roof + 30.0) {
          float lit;
          vec4 w;
          if (id == vec2(0.0)) {
            // ---- our window: the cursor becoming a window ----
            float c = covR(r, p);
            vec2 uv = (p - r.xy) / (r.zw - r.xy);
            float dev = smoothstep(0.0, 0.5, uLt);           // 0 on f5184 → 1 after half a second
            float lev = mix(2.0, 1.6, smoothstep(0.0, 3.0, uLt));
            vec3 K = mix(CURSOR, WINDOW / max(WINDOW.r, 1e-3), dev);
            vec2 lp = vec2(0.16, 0.9);
            float g = exp(-dot((uv - lp) * vec2(1.0, 0.55), (uv - lp) * vec2(1.0, 0.55)) / 0.075);
            float curtain = mix(0.34, 1.0, smoothstep(0.9, 0.62, uv.x));                // soft shadow at the right edge
            float detail = (0.26 + 0.74 * g) * curtain * (0.82 + 0.18 * uv.y) * sash(p - r.xy, r.zw - r.xy, 0.3);
            float shade = mix(1.0, detail, dev);
            w = vec4(K * lev * shade * c, c);
            lit = lev;
          } else {
            w = windowAt(p, r, id, 0.0, lit);
          }
          if (w.a > 0.0) col = col * (1.0 - w.a) + w.rgb;   // unlit glass: nothing (pure silhouette)
          // sill catching the light, and a faint airy glow around lit windows
          float sill = covR(vec4(r.x - 2.0, r.w + 1.0, r.z + 2.0, r.w + 3.0), p);
          col += WINDOW * 0.035 * lit * sill;
          vec2 dq = max(abs(p - 0.5 * (r.xy + r.zw)) - 0.5 * (r.zw - r.xy), 0.0);
          float dd = length(dq);
          col += WINDOW * lit * 0.022 * exp(-dd / 7.0) * step(0.01, dd);
        }
      }
      // building 2 windows: smaller (farther), 15×38 px, pitch 46 × 52 px
      if (p.x >= 1262.0 && p.y > 386.0) {
        float i = floor((p.x - 1286.0 + 15.0) / 46.0);
        float j = floor((p.y - 398.0 + 7.0) / 52.0);
        vec4 r = vec4(1286.0 + 46.0 * i, 398.0 + 52.0 * j, 1301.0 + 46.0 * i, 436.0 + 52.0 * j);
        if (r.x > 1268.0) {
          float lit;
          vec4 w = windowAt(p, r, vec2(i, j), 1.0, lit);
          w.rgb *= 0.8;                                    // a little haze between us and it
          if (w.a > 0.0) col = col * (1.0 - w.a) + w.rgb;
          vec2 dq = max(abs(p - 0.5 * (r.xy + r.zw)) - 0.5 * (r.zw - r.xy), 0.0);
          float dd = length(dq);
          col += WINDOW * lit * 0.016 * exp(-dd / 6.0) * step(0.01, dd);
        }
      }
      // the night air in front of everything: sodium haze from the street
      col += SODIUM * 0.004 * street * street;
      gl_FragColor = vec4(col, 1.0);
    }`, U);

  return {
    render(shot, f) {
      U.uT.value = f.t; U.uLt.value = f.t - T0;
      pass.render(renderer, f.target);
    },
    post(shot, f) {
      // the cut keeps the cursor's optics (S38: bloom 0.8, streak 0.28), then the streak relaxes
      const lt = f.t - T0;
      const k = Math.min(1, Math.max(0, lt / 0.6));
      return { bloom: 0.8, streak: 0.28 + (0.12 - 0.28) * k * k * (3 - 2 * k), bloomThreshold: 1.0 };
    },
  };
}
