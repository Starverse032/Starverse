// Film post pipeline: HDR scene → physically-based mip bloom + anamorphic streak →
// grade (exposure, ACES, saturation/contrast/tint) → film grain, vignette, CA, dither →
// title-card overlay → letterbox → screen (sRGB 8-bit).
import * as THREE from 'three';
import { common, color } from './lib/glsl.js';

const VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class FSQ {
  constructor(material) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
  }
  get material() { return this.mesh.material; }
  set material(m) { this.mesh.material = m; }
  render(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
}

export function makeRT(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: opts.depth ?? false,
    stencilBuffer: false,
    generateMipmaps: false,
    ...opts,
  });
}

const shader = (frag, uniforms) => new THREE.ShaderMaterial({
  vertexShader: VS, fragmentShader: frag, uniforms,
  depthTest: false, depthWrite: false, blending: THREE.NoBlending,
});

export const DEFAULT_POST = {
  exposure: 1.0,
  bloom: 0.9,          // strength of bloom add
  bloomThreshold: 0.9, // HDR luminance where bloom starts
  bloomKnee: 0.6,
  bloomRadius: 1.0,    // 0..1.5 widens upsample tent
  streak: 0.0,         // anamorphic horizontal flare strength
  streakTint: [0.55, 0.75, 1.0],
  ca: 0.0012,          // chromatic aberration (radial, uv units at corner)
  vignette: 0.28,
  grain: 0.035,
  saturation: 1.0,
  contrast: 1.0,
  tint: [1, 1, 1],     // multiplied in linear before tonemap
  lift: [0, 0, 0],     // added in display space (shadows tint)
  fade: 0.0,           // 0 = none, 1 = black
  flash: 0.0,          // additive HDR flash
  flashColor: [1, 0.96, 0.9],
  blackLevel: 0.0,
};

export class Post {
  constructor(renderer, W, H) {
    this.r = renderer; this.W = W; this.H = H;
    const levels = 6;
    this.mips = []; this.ups = [];
    for (let i = 0; i < levels; i++) {
      const w = Math.max(2, W >> (i + 1)), h = Math.max(2, H >> (i + 1));
      this.mips.push(makeRT(w, h));
      this.ups.push(makeRT(w, h));
    }
    const sw = W >> 2, sh = H >> 3;
    this.streakA = makeRT(sw, sh); this.streakB = makeRT(sw, sh);

    this.prefilter = shader(common + /* glsl */ `
      varying vec2 vUv; uniform sampler2D src; uniform vec2 texel; uniform float thr, knee;
      vec3 s(vec2 o){ return texture2D(src, vUv + o * texel).rgb; }
      float kw(vec3 c){ return 1.0 / (1.0 + luma(c)); } // Karis average against fireflies
      vec3 bright(vec3 c){ float l = luma(c); float soft = clamp(l - thr + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
        float w = max(soft, l - thr) / max(l, 1e-4); return c * max(w, 0.0); }
      void main(){
        vec3 a = s(vec2(-1,-1)), b = s(vec2(1,-1)), c = s(vec2(-1,1)), d = s(vec2(1,1)), e = s(vec2(0));
        float wa = kw(a), wb = kw(b), wc = kw(c), wd = kw(d), we = kw(e);
        vec3 col = (a*wa + b*wb + c*wc + d*wd + e*we * 2.0) / (wa + wb + wc + wd + we * 2.0);
        gl_FragColor = vec4(bright(col), 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() }, thr: { value: 1 }, knee: { value: 0.5 } });

    // 13-tap downsample (CoD: AW)
    this.down = shader(/* glsl */ `
      varying vec2 vUv; uniform sampler2D src; uniform vec2 texel;
      vec3 s(vec2 o){ return texture2D(src, vUv + o * texel).rgb; }
      void main(){
        vec3 a=s(vec2(-2,2)), b=s(vec2(0,2)), c=s(vec2(2,2)), d=s(vec2(-2,0)), e=s(vec2(0)), f=s(vec2(2,0)),
             g=s(vec2(-2,-2)), h=s(vec2(0,-2)), i=s(vec2(2,-2)), j=s(vec2(-1,1)), k=s(vec2(1,1)), l=s(vec2(-1,-1)), m=s(vec2(1,-1));
        vec3 col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
        gl_FragColor = vec4(col, 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() } });

    // 9-tap tent upsample + add current level
    this.up = shader(/* glsl */ `
      varying vec2 vUv; uniform sampler2D low, cur; uniform vec2 texel; uniform float radius;
      vec3 s(vec2 o){ return texture2D(low, vUv + o * texel * radius).rgb; }
      void main(){
        vec3 col = s(vec2(0))*4.0 + (s(vec2(-1,0))+s(vec2(1,0))+s(vec2(0,-1))+s(vec2(0,1)))*2.0 + s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1));
        gl_FragColor = vec4(col / 16.0 + texture2D(cur, vUv).rgb, 1.0);
      }`, { low: { value: null }, cur: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } });

    this.hblur = shader(/* glsl */ `
      varying vec2 vUv; uniform sampler2D src; uniform vec2 texel; uniform float spread;
      void main(){
        vec3 c = vec3(0.0); float wsum = 0.0;
        for(int i = -7; i <= 7; i++){ float w = exp(-float(i*i) / 18.0); c += texture2D(src, vUv + vec2(float(i) * spread * texel.x, 0.0)).rgb * w; wsum += w; }
        gl_FragColor = vec4(c / wsum, 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() }, spread: { value: 1 } });

    this.mix = shader(/* glsl */ `
      varying vec2 vUv; uniform sampler2D a, b; uniform float m;
      void main(){ gl_FragColor = vec4(mix(texture2D(a, vUv).rgb, texture2D(b, vUv).rgb, m), 1.0); }`,
      { a: { value: null }, b: { value: null }, m: { value: 0 } });

    this.composite = shader(common + color + /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tScene, tBloom, tStreak, tCards;
      uniform vec2 res; uniform float time;
      uniform float exposure, bloom, streak, ca, vignette, grain, saturation, contrast, fade, flash, bar, cardsOn, blackLevel;
      uniform vec3 tint, lift, flashColor, streakTint;
      void main(){
        vec2 uv = vUv;
        vec2 d = uv - 0.5;
        vec3 sc;
        if (ca > 0.0) {
          vec2 off = d * ca * 2.0;
          sc.r = texture2D(tScene, uv - off).r;
          sc.g = texture2D(tScene, uv).g;
          sc.b = texture2D(tScene, uv + off).b;
        } else sc = texture2D(tScene, uv).rgb;
        vec3 hdr = sc + texture2D(tBloom, uv).rgb * bloom + texture2D(tStreak, uv).rgb * streak * streakTint;
        hdr += flashColor * flash;
        hdr *= tint * exposure;
        float l = luma(hdr);
        hdr = max(mix(vec3(l), hdr, saturation), 0.0);
        vec3 col = acesFitted(hdr);
        // vignette (in linear display)
        float v = 1.0 - vignette * smoothstep(0.25, 1.05, length(d * vec2(res.x / res.y, 1.0)) * 0.95);
        col *= v;
        col = linearToSRGB(col);
        col = (col - 0.5) * contrast + 0.5;
        col += lift * (1.0 - col);
        col = max(col, 0.0);
        col = max(col - blackLevel, 0.0) / (1.0 - blackLevel);
        // grain: luminance-weighted, animated per frame
        vec2 px = floor(uv * res);
        float n = hash12(px + vec2(time * 61.7, time * 17.3)) + hash12(px * 1.37 + vec2(time * 13.1, 5.3)) - 1.0;
        float lum = luma(col);
        col += n * grain * (1.0 - 0.7 * lum);
        col *= 1.0 - fade;
        // cards (straight alpha, display space)
        if (cardsOn > 0.5) { vec4 c = texture2D(tCards, vec2(uv.x, 1.0 - uv.y)); col = mix(col, c.rgb, c.a); }
        // dither to 8-bit
        col += (hash12(px + 0.5 + fract(time) * 101.0) - 0.5) / 255.0;
        // letterbox with 1px AA edge
        float ypx = uv.y * res.y; float barPx = bar * res.y;
        float inside = smoothstep(barPx - 0.5, barPx + 0.5, ypx) * smoothstep(barPx - 0.5, barPx + 0.5, res.y - ypx);
        col *= inside;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`, {
      tScene: { value: null }, tBloom: { value: null }, tStreak: { value: null }, tCards: { value: null },
      res: { value: new THREE.Vector2(W, H) }, time: { value: 0 },
      exposure: { value: 1 }, bloom: { value: 1 }, streak: { value: 0 }, ca: { value: 0 }, vignette: { value: 0 },
      grain: { value: 0 }, saturation: { value: 1 }, contrast: { value: 1 }, fade: { value: 0 }, flash: { value: 0 },
      bar: { value: 0 }, cardsOn: { value: 0 }, blackLevel: { value: 0 },
      tint: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3() }, flashColor: { value: new THREE.Vector3(1, 1, 1) },
      streakTint: { value: new THREE.Vector3(1, 1, 1) },
    });
    this.fsq = new FSQ(this.composite);
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); this.black.needsUpdate = true;
  }

  pass(mat, target) { this.fsq.material = mat; this.fsq.render(this.r, target); }

  // running average: acc = mix(acc, src, w)  (w = 1/(k+1) gives the mean of k+1 samples)
  accumulate(src, acc, w) {
    if (!this.acc) {
      this.acc = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: `varying vec2 vUv; uniform sampler2D s; uniform float w; void main(){ gl_FragColor = vec4(texture2D(s, vUv).rgb, w); }`,
        uniforms: { s: { value: null }, w: { value: 1 } }, depthTest: false, depthWrite: false, transparent: true,
        blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation });
    }
    this.acc.uniforms.s.value = src.texture; this.acc.uniforms.w.value = w;
    this.r.setRenderTarget(acc);
    if (w >= 1) { this.r.setClearColor(0x000000, 1); this.r.clear(true, false, false); }
    this.fsq.material = this.acc; this.fsq.render(this.r, acc);
  }

  blend(a, b, m, target) {
    const u = this.mix.uniforms; u.a.value = a.texture; u.b.value = b.texture; u.m.value = m;
    this.pass(this.mix, target);
  }

  // src: HDR render target; P: post params; bar: letterbox bar height as fraction of H; cardsTex or null
  run(src, P, { bar = 0, time = 0, cardsTex = null } = {}) {
    const r = this.r;
    let streakTex = this.black, bloomTex = this.black;
    if (P.bloom > 0 || P.streak > 0) {
      const pf = this.prefilter.uniforms;
      pf.src.value = src.texture; pf.texel.value.set(1 / src.width, 1 / src.height); pf.thr.value = P.bloomThreshold; pf.knee.value = Math.max(1e-3, P.bloomKnee);
      this.pass(this.prefilter, this.mips[0]);
      for (let i = 1; i < this.mips.length; i++) {
        const u = this.down.uniforms; const s = this.mips[i - 1];
        u.src.value = s.texture; u.texel.value.set(1 / s.width, 1 / s.height);
        this.pass(this.down, this.mips[i]);
      }
      if (P.bloom > 0) {
        let low = this.mips[this.mips.length - 1];
        for (let i = this.mips.length - 2; i >= 0; i--) {
          const u = this.up.uniforms;
          u.low.value = low.texture; u.cur.value = this.mips[i].texture; u.texel.value.set(1 / low.width, 1 / low.height); u.radius.value = P.bloomRadius;
          this.pass(this.up, this.ups[i]);
          low = this.ups[i];
        }
        bloomTex = this.ups[0].texture;
      }
      if (P.streak > 0) {
        const u = this.hblur.uniforms;
        u.src.value = this.mips[1].texture; u.texel.value.set(1 / this.streakA.width, 1 / this.streakA.height); u.spread.value = 1.0;
        this.pass(this.hblur, this.streakA);
        u.src.value = this.streakA.texture; u.spread.value = 4.0; this.pass(this.hblur, this.streakB);
        u.src.value = this.streakB.texture; u.spread.value = 12.0; this.pass(this.hblur, this.streakA);
        u.src.value = this.streakA.texture; u.spread.value = 30.0; this.pass(this.hblur, this.streakB);
        streakTex = this.streakB.texture;
      }
    }
    const u = this.composite.uniforms;
    u.tScene.value = src.texture; u.tBloom.value = bloomTex; u.tStreak.value = streakTex;
    u.tCards.value = cardsTex || this.black; u.cardsOn.value = cardsTex ? 1 : 0;
    u.time.value = time; u.bar.value = bar;
    for (const k of ['exposure', 'bloom', 'streak', 'ca', 'vignette', 'grain', 'saturation', 'contrast', 'fade', 'flash', 'blackLevel']) u[k].value = P[k];
    u.tint.value.fromArray(P.tint); u.lift.value.fromArray(P.lift); u.flashColor.value.fromArray(P.flashColor); u.streakTint.value.fromArray(P.streakTint);
    this.pass(this.composite, null);
    r.setRenderTarget(null);
  }
}
