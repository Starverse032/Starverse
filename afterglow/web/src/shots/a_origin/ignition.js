// a_origin / ignition — the ignition law of long take A (screenplay S02-b/c), on the shared WEB graph.
//   rank 0 = web.hero.first   f888 (37.0 s, at R; its first frame is the cursor footprint)
//   rank 1 = the node nearest to (1086, 422) on screen at f936 (WEB_PATH_A camera), ignites f936 (39.0 s)
//   rank k ≥ 2 ignites 40 + 0.5·log2(k − 1) s  ⇔  N(t) = 2^((t − 40)/0.5); order = hop distance from
//   hero.first in the WEB graph, ties by Euclidean distance.  → 66 stars by f1032, all by ≈ 46.2 s;
//   filaments light from their two end nodes (PROP s per edge) → the web is fully lit by 47.0 (f1128).
import * as THREE from 'three';
import { getWeb, hopDistances, webPathAPose } from '../_webgraph.js';

export const T_FIRST = 37.0, T_SECOND = 39.0, T_LAW = 40.0, LAW_HALF = 0.5, PROP = 0.6;
export const SECOND_PX = [1086, 422];

let CACHE = null;
export function ignitionA() {
  if (CACHE) return CACHE;
  const web = getWeb();
  const { N, nodes } = web;
  const first = web.hero.first;
  const hop = hopDistances(web, first);
  const fx = nodes[3 * first], fy = nodes[3 * first + 1], fz = nodes[3 * first + 2];
  const eu = new Float32Array(N);
  for (let i = 0; i < N; i++) eu[i] = Math.hypot(nodes[3 * i] - fx, nodes[3 * i + 1] - fy, nodes[3 * i + 2] - fz);
  // the second star: nearest node to (1086, 422) at f936, at least 25 u in front of the camera
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 5000); cam.filmGauge = 36; cam.setFocalLength(24);
  const P = webPathAPose(936);
  cam.position.copy(P.pos); cam.up.copy(P.up); cam.lookAt(P.target); cam.updateMatrixWorld();
  const v = new THREE.Vector3(), vv = new THREE.Vector3();
  let second = -1, best = 1e9;
  for (let i = 0; i < N; i++) {
    if (i === first) continue;
    v.set(nodes[3 * i], nodes[3 * i + 1], nodes[3 * i + 2]);
    vv.copy(v).applyMatrix4(cam.matrixWorldInverse);
    if (-vv.z < 25) continue;
    v.project(cam);
    const x = (v.x + 1) / 2 * 1920, y = (1 - v.y) / 2 * 1080;
    const dd = Math.hypot(x - SECOND_PX[0], y - SECOND_PX[1]) + 0.02 * -vv.z;   // prefer the nearer of equals
    if (dd < best) { best = dd; second = i; }
  }
  const hk = i => (hop[i] < 0 ? 1e6 : hop[i]);
  const rest = [];
  for (let i = 0; i < N; i++) if (i !== first && i !== second) rest.push(i);
  // nodes inside the f1032 frame first — so the stars lit by 43.0 are the ones the camera sees
  // (S02-K10: 50–80 in frame at f1032)
  const P2 = webPathAPose(1032);
  cam.position.copy(P2.pos); cam.up.copy(P2.up); cam.lookAt(P2.target); cam.updateMatrixWorld();
  const inF = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    v.set(nodes[3 * i], nodes[3 * i + 1], nodes[3 * i + 2]);
    vv.copy(v).applyMatrix4(cam.matrixWorldInverse);
    if (vv.z > -1) continue;
    v.project(cam);
    const x = (v.x + 1) / 2 * 1920, y = (1 - v.y) / 2 * 1080;
    inF[i] = x > 40 && x < 1880 && y > 160 && y < 920 ? 1 : 0;
  }
  // off-frame nodes are delayed by 3 hops: on screen the stars still ignite strictly in hop order
  const key = i => hk(i) + 3 * (1 - inF[i]);
  rest.sort((a, b) => (key(a) - key(b)) || (eu[a] - eu[b]));
  const order = [first, second, ...rest];
  const rank = new Int32Array(N), tIgn = new Float32Array(N);
  order.forEach((n, k) => {
    rank[n] = k;
    tIgn[n] = k === 0 ? T_FIRST : k === 1 ? T_SECOND : T_LAW + LAW_HALF * Math.log2(k - 1);
  });
  CACHE = { web, order: Int32Array.from(order), rank, tIgn, hop, eu, first, second, secondErrPx: best };
  return CACHE;
}
