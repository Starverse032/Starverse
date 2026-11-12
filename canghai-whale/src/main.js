import * as THREE from 'three';
import { initMaterials, G } from './materials.js';
import { Environment } from './sky.js';
import { Pipeline } from './post.js';
import { buildWorld } from './world.js';
import { buildVegetation } from './vegetation.js';

const params = new URLSearchParams(location.search);
const Q = { cascades: 4, shadowMap: 2048, shadowFar: 520, msaa: 4, ao: true, aoSamples: 12, bloom: true, pixelRatio: 1.5, treeFraction: 1, treeShadows: true };
if (params.get('q') === 'test') Object.assign(Q, { shadowMap: 1024, msaa: 0, aoSamples: 8, pixelRatio: 1 });
for (const k of ['ao', 'bloom', 'msaa', 'cascades', 'treeFraction', 'shadowMap']) if (params.has(k)) Q[k] = Number(params.get(k));

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.25, 12000);
camera.position.set(-140, 60, -120);
camera.lookAt(40, 10, 20);

const env = new Environment(renderer, scene, camera, Q);
initMaterials(env.csm);
const world = buildWorld(scene);
const veg = buildVegetation(scene, world.data, Q);
const pipe = new Pipeline(renderer, scene, camera, Q);

if (params.get('cam')) {
  const c = params.get('cam').split(',').map(Number);
  camera.position.set(c[0], c[1], c[2]);
  camera.lookAt(c[3], c[4], c[5]);
}
if (params.get('t')) env.setTime(parseFloat(params.get('t')), true);
if (params.get('fov')) { camera.fov = parseFloat(params.get('fov')); camera.updateProjectionMatrix(); }
env.csm.updateFrustums();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  env.csm.updateFrustums();
  pipe.setSize();
});

let last = performance.now(), time = 0, frames = 0;
const freezeAt = Number(params.get('freeze') || 0);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  G.uTime.value = time;
  camera.updateMatrixWorld();
  env.update(dt, time);
  if (params.get('pp') === '0') { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.setRenderTarget(null); renderer.render(scene, camera); }
  else pipe.render(dt, time, 0);
  frames++;
  window.__frames = frames;
  if (freezeAt && frames >= freezeAt) { window.__frozen = true; return; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__game = { scene, camera, env, world, renderer, pipe };
