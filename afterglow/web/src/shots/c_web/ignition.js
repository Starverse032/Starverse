// Shared ignition law of the first stars (cosmos team): S09 c_firststar and S10 c_web light the
// SAME web nodes at the SAME instants, so the hard cut at 43.0 continues one process.
//
//   rank 0  = web.hero.first          ignites 37.0 (on the beat, at R; frame f888 = cursor footprint)
//   rank 1  = nearest hop-1 neighbour ignites 39.0 (placed at (1086, 422) by the S09 camera)
//   rank k≥2                          ignites 40 + 0.5·log2(k − 1)   ⇔  N(t) = 2^((t − 40)/0.5)
//   order = hop distance in the WEB graph from the first star, ties by Euclidean distance.
//   → 64 stars after the second by 43.0; the last of ~5060 nodes at ≈ 46.2 s; the web (filaments
//     light from their two end nodes, PROP seconds per edge) is fully lit by 47.0.
import { getWeb, hopDistances } from '../_webgraph.js';

export const T_FIRST = 37.0, T_SECOND = 39.0, T_LAW = 40.0, LAW_HALF = 0.5;
export const PROP = 0.6;   // s for the ignition front to run along one filament (S10)

let CACHE = null;
export function ignition() {
  if (CACHE) return CACHE;
  const web = getWeb();
  const { N, nodes } = web;
  const first = web.hero.first;
  const hop = hopDistances(web, first);
  const fx = nodes[3 * first], fy = nodes[3 * first + 1], fz = nodes[3 * first + 2];
  const eu = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const dx = nodes[3 * i] - fx, dy = nodes[3 * i + 1] - fy, dz = nodes[3 * i + 2] - fz;
    eu[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  const order = Array.from({ length: N }, (_, i) => i);
  // unreachable nodes (hop −1) go last, by distance
  const hk = i => (hop[i] < 0 ? 1e6 : hop[i]);
  order.sort((a, b) => (hk(a) - hk(b)) || (eu[a] - eu[b]));
  const rank = new Int32Array(N), tIgn = new Float32Array(N);
  order.forEach((n, k) => {
    rank[n] = k;
    tIgn[n] = k === 0 ? T_FIRST : k === 1 ? T_SECOND : T_LAW + LAW_HALF * Math.log2(k - 1);
  });
  CACHE = { web, order: Int32Array.from(order), rank, tIgn, hop, eu, first, second: order[1] };
  return CACHE;
}
