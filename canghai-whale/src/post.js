import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * HDR render pipeline: MSAA scene -> ground-truth ambient occlusion -> bloom -> tone mapping + grade.
 */
export class Pipeline {
  constructor(renderer, scene, camera, q) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.q = q;
    this.bloomThreshold = 3.2;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, size.x), h = Math.max(2, size.y);
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    this.rtScene = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: q.msaa, depthTexture: depth, depthBuffer: true,
    });
    this.rtA = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    this.ao = null;
    if (q.ao) {
      this.ao = new GTAOPass(scene, camera, w, h, { depthTexture: depth },
        { radius: 1.6, distanceExponent: 1.4, thickness: 2.2, scale: 1.25, samples: q.aoSamples, distanceFallOff: 1.0, screenSpaceRadius: false },
        { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1.5, rings: 2, samples: 8 });
      this.ao.blendIntensity = 1.0;
    }
    this.bloom = q.bloom ? new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.7, 3.2) : null;
    if (this.bloom) {
      // one NaN / Inf pixel would be smeared over the whole frame by the blur chain: sanitise the input
      const hp = this.bloom.materialHighPassFilter;
      hp.fragmentShader = hp.fragmentShader.replace('vec4 texel = texture2D( tDiffuse, vUv );',
        'vec4 texel = texture2D( tDiffuse, vUv );\n\t\t\tif ( any( isnan( texel ) ) || any( isinf( texel ) ) ) texel = vec4( 0.0 );\n\t\t\ttexel.rgb = min( texel.rgb, vec3( 48.0 ) );');
      hp.needsUpdate = true;
    }
    this.final = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, uExposure: { value: 1 }, uVignette: { value: 0.28 }, uSaturation: { value: 1.08 },
        uSpeed: { value: 0 }, uAspect: { value: w / h }, uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse; uniform float uExposure, uVignette, uSaturation, uSpeed, uAspect, uTime;
        varying vec2 vUv;
        // ACES filmic (Stephen Hill's fit)
        vec3 RRTAndODTFit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
        vec3 aces(vec3 color){
          const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
          const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
          color = inM * color; color = RRTAndODTFit(color); color = outM * color; return clamp(color, 0.0, 1.0);
        }
        float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        void main(){
          vec2 c = vUv - 0.5;
          // speed: subtle radial chromatic stretch towards the edges
          float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
          vec2 dir = c * r2 * 0.035 * uSpeed;
          vec3 col;
          col.r = texture2D(tDiffuse, vUv - dir * 1.0).r;
          col.g = texture2D(tDiffuse, vUv - dir * 0.5).g;
          col.b = texture2D(tDiffuse, vUv).b;
          if (any(isnan(col)) || any(isinf(col))) col = texture2D(tDiffuse, vUv + vec2(0.0015, 0.0)).rgb;
          if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
          col *= uExposure;
          col = aces(col);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSaturation);
          col *= 1.0 - uVignette * smoothstep(0.25, 1.1, r2 * 1.6);
          col = pow(col, vec3(1.0 / 2.2));
          col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;   // dither away banding in the sky
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    }));
  }

  setSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, size.x), h = Math.max(2, size.y);
    this.rtScene.setSize(w, h);
    this.rtA.setSize(w, h);
    if (this.ao) this.ao.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
    this.final.material.uniforms.uAspect.value = w / h;
  }

  render(dt, time, speedFx = 0) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);
    let read = this.rtScene;
    if (this.ao) {
      this.ao.render(r, this.rtA, read);
      read = this.rtA;
    }
    if (this.bloom) { this.bloom.threshold = this.bloomThreshold; this.bloom.render(r, null, read, dt, false); }
    const u = this.final.material.uniforms;
    u.tDiffuse.value = read.texture;
    u.uExposure.value = r.toneMappingExposure;
    u.uSpeed.value = speedFx;
    u.uTime.value = time;
    r.setRenderTarget(null);
    this.final.render(r);
  }
}
