// Shared WEB (seed 1990): the cosmic-web node graph and the WEB_PATH camera spline.
// Used by c_firststar (S09: first stars = web nodes), c_web (S10), w_sea (S34–S36) and q_apex (S37):
// the inner universe of words must have exactly the same shape as the outer universe of stars.
//
//   import { getWeb, webPathPose, sampleWebPoints, WEB } from './_webgraph.js';
//   const web = getWeb();                         // { nodes Float32Array(N*3), N, edges Uint32Array(2E), E, degree, hero }
//   const pose = webPathPose(lt);                 // { pos, target, up, roll } at S10/S35 local time lt (0..9 s)
//   const pts = sampleWebPoints(web, 600000, 7);  // { pos Float32Array(n*3), nodeOf Uint32Array, along Float32Array, kind Uint8Array }
import * as THREE from 'three';
import { rng } from '../lib/util.js';

export const WEB = {
  seed: 1990,
  box: 400,            // web box edge (units)
  nodes: 5000,
  speed: 9,            // units / s after the ramp
  accel: 2,            // s, easeInQuad ramp of *speed* 0 → 9
  duration: 9,         // S10 and S35 are both 9 s
  rollDeg: 3,          // roll −3° → +3°
  focalMM: 24,
};

// --- WEB_PATH: Catmull–Rom through 6 control points, arc-length parameterised -------------
const CTRL = [
  [-34, -10, 78], [-22, -5, 44], [-8, 1, 12], [3, 4, -20], [11, 2, -52], [16, -3, -86],
].map(p => new THREE.Vector3(...p));
const CURVE = new THREE.CatmullRomCurve3(CTRL, false, 'centripetal');
CURVE.arcLengthDivisions = 2000;
const PATH_LEN = CURVE.getLength();

// distance travelled along the path at local time lt (speed ramps with easeInQuad over WEB.accel)
export function webPathDistance(lt) {
  const a = WEB.accel, v = WEB.speed;
  if (lt <= 0) return 0;
  if (lt < a) return v * lt * lt * lt / (3 * a * a);       // ∫ v (t/a)² dt
  return v * a / 3 + v * (lt - a);
}

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
export function webPathPose(lt) {
  const s = Math.min(PATH_LEN - 12, webPathDistance(lt));
  const u = CURVE.getUtoTmapping(s / PATH_LEN);
  const u2 = CURVE.getUtoTmapping(Math.min(1, (s + 10) / PATH_LEN));  // look 10 units ahead
  CURVE.getPoint(u, _p); CURVE.getPoint(u2, _q);
  _f.subVectors(_q, _p).normalize();
  const roll = -WEB.rollDeg * Math.cos(Math.PI * Math.min(1, Math.max(0, lt / WEB.duration))) * Math.PI / 180;
  _r.crossVectors(_f, new THREE.Vector3(0, 1, 0)).normalize();
  _u.crossVectors(_r, _f).normalize();
  const up = _u.clone().multiplyScalar(Math.cos(roll)).addScaledVector(_r, Math.sin(roll));
  return { pos: _p.clone(), target: _q.clone(), forward: _f.clone(), right: _r.clone(), up, roll };
}

// Apply a pose to a camera (position, up with roll, lookAt).
export function applyWebPose(cam, lt) {
  const P = webPathPose(lt);
  cam.position.copy(P.pos); cam.up.copy(P.up); cam.lookAt(P.target);
  cam.updateMatrixWorld();
  return P;
}

// --- smooth deterministic density for voids / clusters (no Math.random) -------------------
function density(x, y, z) {
  const f = (a, b, c) => Math.sin(a) * Math.cos(b) + Math.sin(b) * Math.cos(c) + Math.sin(c) * Math.cos(a); // gyroid-ish
  const s1 = f(x * 0.028 + 1.3, y * 0.028 + 0.4, z * 0.028 + 2.1);
  const s2 = f(x * 0.061 + 4.1, y * 0.061 + 2.7, z * 0.061 + 0.9);
  return 0.5 + 0.32 * s1 + 0.16 * s2; // 0..~1
}

let CACHE = null;
export function getWeb() {
  if (CACHE) return CACHE;
  const r = rng(WEB.seed);
  const B = WEB.box, H = B / 2;
  const nodes = [];
  // jittered grid + rejection against the density field (keeps ~WEB.nodes)
  const g = 22, cell = B / g;
  const cand = [];
  for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) for (let k = 0; k < g; k++) {
    const x = -H + (i + r()) * cell, y = -H + (j + r()) * cell, z = -H + (k + r()) * cell;
    const rad = Math.sqrt(x * x + y * y + z * z) / H;   // soft spherical boundary: no visible box faces
    cand.push([x, y, z, density(x, y, z) - Math.max(0, rad - 0.55) * 2.2, r()]);
  }
  cand.sort((a, b) => (b[3] - b[4] * 0.35) - (a[3] - a[4] * 0.35));
  for (let i = 0; i < Math.min(WEB.nodes - 40, cand.length); i++) nodes.push(cand[i].slice(0, 3));

  // hero filament: a chain of nodes ahead of the camera at lt = 3 s, running bottom-left → top-right
  const P3 = webPathPose(3);
  const centre = P3.pos.clone().addScaledVector(P3.forward, 46);
  const dir = P3.right.clone().addScaledVector(P3.up, 0.42).normalize();
  const heroFil = [];
  for (let k = -9; k <= 9; k++) {
    const p = centre.clone().addScaledVector(dir, k * 7.5).addScaledVector(P3.forward, (r() - 0.5) * 6).addScaledVector(P3.up, (r() - 0.5) * 2.5);
    heroFil.push(nodes.length); nodes.push([p.x, p.y, p.z]);
  }
  // hero node: at lt = 6 s it sits on the right third, ~10 units ahead → whips past ~1 s later
  const P6 = webPathPose(6);
  const hp = P6.pos.clone().addScaledVector(P6.forward, 10).addScaledVector(P6.right, 2.6).addScaledVector(P6.up, 0.35);
  const heroNode = nodes.length; nodes.push([hp.x, hp.y, hp.z]);

  const N = nodes.length;
  const pos = new Float32Array(N * 3);
  nodes.forEach((p, i) => pos.set(p, i * 3));
  // k-nearest neighbours via a uniform grid hash
  const gs = 24, inv = gs / B;
  const buckets = new Map();
  const key = (a, b, c) => (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  const cellOf = i => [Math.floor((pos[3 * i] + H) * inv), Math.floor((pos[3 * i + 1] + H) * inv), Math.floor((pos[3 * i + 2] + H) * inv)];
  for (let i = 0; i < N; i++) { const [a, b, c] = cellOf(i); const k = key(a, b, c); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(i); }
  const edgeSet = new Set();
  const edges = [];
  const degree = new Uint16Array(N);
  const addEdge = (i, j) => { const a = Math.min(i, j), b = Math.max(i, j), k = a * 65536 + b; if (edgeSet.has(k)) return; edgeSet.add(k); edges.push(a, b); degree[a]++; degree[b]++; };
  for (let i = 0; i < N; i++) {
    const [a, b, c] = cellOf(i);
    const near = [];
    for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) for (let dc = -1; dc <= 1; dc++) {
      const L = buckets.get(key(a + da, b + db, c + dc)); if (!L) continue;
      for (const j of L) if (j !== i) {
        const dx = pos[3 * j] - pos[3 * i], dy = pos[3 * j + 1] - pos[3 * i + 1], dz = pos[3 * j + 2] - pos[3 * i + 2];
        near.push([dx * dx + dy * dy + dz * dz, j]);
      }
    }
    near.sort((p, q) => p[0] - q[0]);
    const k = 3 + ((i * 2654435761) >>> 31); // 3 or 4, deterministic
    for (let m = 0; m < Math.min(k, near.length); m++) addEdge(i, near[m][1]);
  }
  for (let k = 0; k < heroFil.length - 1; k++) addEdge(heroFil[k], heroFil[k + 1]);
  CACHE = { nodes: pos, N, edges: new Uint32Array(edges), E: edges.length / 2, degree, hero: { filament: heroFil, node: heroNode } };
  return CACHE;
}

// Points along the web: `count` points split between filaments (∝ 1/length, gaussian σ = 0.02 L)
// and node clumps (∝ degree). kind: 0 = filament, 1 = node clump. along: 0..1 position on the edge
// (node clumps: 0). nodeOf: nearest node index (for ignition order / birth time).
export function sampleWebPoints(web, count, seed = 7, { clumpShare = 0.25 } = {}) {
  const r = rng(seed);
  const { nodes, edges, E, N, degree } = web;
  const pos = new Float32Array(count * 3), nodeOf = new Uint32Array(count), along = new Float32Array(count), kind = new Uint8Array(count);
  const lens = new Float32Array(E); let wsum = 0;
  for (let e = 0; e < E; e++) {
    const a = edges[2 * e], b = edges[2 * e + 1];
    const dx = nodes[3 * b] - nodes[3 * a], dy = nodes[3 * b + 1] - nodes[3 * a + 1], dz = nodes[3 * b + 2] - nodes[3 * a + 2];
    lens[e] = Math.sqrt(dx * dx + dy * dy + dz * dz);
    wsum += 1; // equal points per edge → density ∝ 1/length
  }
  const nClump = Math.round(count * clumpShare), nFil = count - nClump;
  let degSum = 0; for (let i = 0; i < N; i++) degSum += degree[i];
  let o = 0;
  // filaments
  for (let e = 0; e < E && o < nFil; e++) {
    const per = Math.round(nFil / wsum) + (r() < (nFil / wsum) % 1 ? 1 : 0);
    const a = edges[2 * e], b = edges[2 * e + 1], L = lens[e];
    for (let k = 0; k < per && o < nFil; k++, o++) {
      const u = r();
      const s = 0.02 * L;
      pos[3 * o] = nodes[3 * a] + (nodes[3 * b] - nodes[3 * a]) * u + r.gauss() * s;
      pos[3 * o + 1] = nodes[3 * a + 1] + (nodes[3 * b + 1] - nodes[3 * a + 1]) * u + r.gauss() * s;
      pos[3 * o + 2] = nodes[3 * a + 2] + (nodes[3 * b + 2] - nodes[3 * a + 2]) * u + r.gauss() * s;
      nodeOf[o] = u < 0.5 ? a : b; along[o] = u; kind[o] = 0;
    }
  }
  // node clumps
  for (let i = 0; i < N && o < count; i++) {
    const n = Math.round(nClump * degree[i] / degSum + (i === web.hero.node ? 600 : 0));
    const sig = 0.6 + 0.25 * degree[i];
    for (let k = 0; k < n && o < count; k++, o++) {
      const rr = Math.abs(r.gauss()) * sig * Math.pow(r(), 0.5);
      const d = r.sphere();
      pos[3 * o] = nodes[3 * i] + d[0] * rr; pos[3 * o + 1] = nodes[3 * i + 1] + d[1] * rr; pos[3 * o + 2] = nodes[3 * i + 2] + d[2] * rr;
      nodeOf[o] = i; along[o] = 0; kind[o] = 1;
    }
  }
  return { pos: pos.subarray(0, o * 3), nodeOf: nodeOf.subarray(0, o), along: along.subarray(0, o), kind: kind.subarray(0, o), count: o };
}

// Graph distance (in hops) from a start node — for "ignite in order of distance from the first star".
export function hopDistances(web, start) {
  const { N, edges, E } = web;
  const adj = Array.from({ length: N }, () => []);
  for (let e = 0; e < E; e++) { adj[edges[2 * e]].push(edges[2 * e + 1]); adj[edges[2 * e + 1]].push(edges[2 * e]); }
  const d = new Int32Array(N).fill(-1); d[start] = 0;
  const q = [start];
  for (let h = 0; h < q.length; h++) for (const j of adj[q[h]]) if (d[j] < 0) { d[j] = d[q[h]] + 1; q.push(j); }
  return d;
}
