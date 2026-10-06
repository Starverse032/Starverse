// Engine smoke test: baked sky + point-sprite stars + 300k drifting particles.
export async function create(ctx) {
  const { THREE, GLSL, W, H, kit, renderer } = ctx;
  const scene = new THREE.Scene();
  const cam = kit.filmCamera(W, H, { focalMM: 35 });
  const skyTex = kit.bakeSky(renderer, { w: 4096, h: 2048, dirFrag: `
    vec3 sky(vec3 d){
      vec3 c = starLayer(d, 900.0, 0.08, 1.0, 0.0012) * 0.5;
      float band = exp(-pow(d.y * 3.0 + 0.4 * fbm(d * 3.0, 4), 2.0));
      float neb = fbm(d * 2.5, 6);
      c += vec3(0.25, 0.35, 0.9) * pow(neb, 3.0) * 0.5 * band + vec3(0.9, 0.45, 0.3) * pow(fbm(d * 3.1 + 4.0, 6), 4.0) * 0.6 * band;
      return c;
    }` });
  scene.add(kit.skyDome(skyTex));
  const stars = kit.starfield({ count: 20000, seed: 3, radius: 3000, H });
  scene.add(stars);
  const N = 300000, r = ctx.util.rng(7), pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { const s = r.sphere(), rad = Math.pow(r(), 0.5) * 30; pos.set([s[0] * rad, s[1] * rad * 0.15, s[2] * rad], i * 3); seed[i] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, H: { value: H } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL.common + `attribute float seed; uniform float t, H; varying float vS; void main(){ vec3 p = position; float a = t * 0.15 / (0.3 + length(p.xz) * 0.05); p.xz = rot2(a) * p.xz;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = max(1.0, 0.04 * H / -mv.z); gl_Position = projectionMatrix * mv; vS = seed; }`,
    fragmentShader: GLSL.common + `varying float vS; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(blackbody(mix(2500.0, 12000.0, vS)) * exp(-d * d * 18.0) * 0.5, 1.0); }` });
  scene.add(new THREE.Points(g, mat));
  return {
    render(shot, f) {
      mat.uniforms.t.value = f.t;
      cam.position.set(Math.sin(f.t * 0.2) * 45, 8 + f.t, Math.cos(f.t * 0.2) * 45); cam.lookAt(0, 0, 0);
      ctx.renderer.setRenderTarget(f.target);
      ctx.renderer.render(scene, cam);
    },
    post(shot, f) { return { streak: 0.4, bloom: 0.8 }; },
  };
}
