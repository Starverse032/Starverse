import { getWeb, sampleWebPoints, applyWebPose, WEB } from './_webgraph.js';
export async function create(ctx) {
  const { THREE, kit, W, H, GLSL } = ctx;
  const t0 = performance.now();
  const web = getWeb();
  const pts = sampleWebPoints(web, 700000, 7);
  console.log('WARN web', web.N, web.E, pts.count, Math.round(performance.now() - t0) + 'ms');
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts.pos, 3));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { H: { value: H } },
    vertexShader: GLSL.common + `uniform float H; varying float vI; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z; float s = 2.2 * H / 1080.0 * clamp(6.0 / d, 0.6, 3.0); gl_PointSize = max(s, 1.0); vI = 0.35 * min(1.0, (s/1.0)*(s/1.0)) ; }`,
    fragmentShader: `varying float vI; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d)*14.0); gl_FragColor = vec4(vec3(0.75,0.82,1.0) * vI * a, 1.0); }` });
  const scene = new THREE.Scene(); scene.add(new THREE.Points(g, mat));
  const cam = kit.filmCamera(W, H, { focalMM: 24, far: 2000 });
  return { render(shot, f) { applyWebPose(cam, f.lt); ctx.renderer.setRenderTarget(f.target); ctx.renderer.render(scene, cam); }, post() { return { bloom: 0.7 }; } };
}
