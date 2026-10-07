// S09 camera solve (deterministic, no randomness): a 50 mm camera whose image puts
//   the first star (web.hero.first, rank 0)  exactly on R = (734, 540)       (pixel centre 734.5, 540.5)
//   the second star (rank 1, ignites 39.0)  exactly on (1086, 422) at 39.0   (pixel centre 1086.5, 422.5)
// and that then dollies straight back, uniformly, along the ray from the first star through the
// camera: distance D(t) = D0·z, z = 1 → 6 over 39.0 → 43.0. Because the camera moves along that ray
// with a fixed orientation, the first star stays pinned on R for the whole shot; the others drift in
// parallax (the second star slides inward a little — it is nearer the lens than the first).
//
// Among all camera directions u (Fibonacci sphere) whose subtended angle matches, choose the one
// that shows the most of the 64 next stars inside the 2.39 band at 43.0 without any of them passing
// close to the lens, preferring a well spread constellation.
import * as THREE from 'three';

export const FOCAL = 50;
export const FPX = 960 / (18 / FOCAL);         // focal length in 1080p px (kit.filmCamera: 36 mm gauge)
export const R_PX = [734.5, 540.5], P2_PX = [1086.5, 422.5];
const camDir = (px, py) => new THREE.Vector3((px - 960) / FPX, -(py - 540) / FPX, -1).normalize();

export function solveCamera(I, { D0 = 26, zEnd = 6, count = 66 } = {}) {
  const { web, order } = I;
  const P = i => new THREE.Vector3(web.nodes[3 * i], web.nodes[3 * i + 1], web.nodes[3 * i + 2]);
  const F = P(order[0]), S = P(order[1]);
  const a = camDir(...R_PX), b = camDir(...P2_PX);
  const theta = a.angleTo(b);
  const angleAt = (u, D) => { const C = F.clone().addScaledVector(u, D); return F.clone().sub(C).angleTo(S.clone().sub(C)); };
  const rotFor = (C) => {
    // rotation R (camera → world) with R·a = dir(F), R·b ≈ dir(S): orthonormal triads
    const wa = F.clone().sub(C).normalize(), wb = S.clone().sub(C).normalize();
    const tri = (x, y) => { const e1 = x.clone(); const e3 = x.clone().cross(y).normalize(); const e2 = e3.clone().cross(e1); return new THREE.Matrix4().makeBasis(e1, e2, e3); };
    const Mc = tri(a, b), Mw = tri(wa, wb);
    return Mw.multiply(Mc.clone().transpose());
  };
  const stars = Array.from(order.slice(0, count), P);
  let best = null;
  const n = 6000, ga = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < n; k++) {
    const y = 1 - 2 * (k + 0.5) / n, r = Math.sqrt(1 - y * y), ph = k * ga;
    const u = new THREE.Vector3(r * Math.cos(ph), y, r * Math.sin(ph));
    // bisection on D in [0.55, 1.8]·D0 for the exact angle (angle shrinks as D grows, mostly)
    let lo = 0.55 * D0, hi = 1.8 * D0, alo = angleAt(u, lo) - theta, ahi = angleAt(u, hi) - theta;
    if (alo * ahi > 0) continue;
    for (let it = 0; it < 40; it++) { const m = 0.5 * (lo + hi), am = angleAt(u, m) - theta; if (am * alo > 0) { lo = m; alo = am; } else hi = m; }
    const D = 0.5 * (lo + hi);
    const C0 = F.clone().addScaledVector(u, D);
    if (S.clone().sub(C0).length() < 8) continue;
    const Rm = rotFor(C0);
    const inv = Rm.clone().transpose();
    // score at 43.0 (z = zEnd) and check the dolly path for near passes
    let vis = 0, near = false, sx = 0, sy = 0, sxx = 0, syy = 0;
    for (let z = 1; z <= zEnd + 1e-6; z += 0.5) {
      const C = F.clone().addScaledVector(u, D * z);
      for (let s = 1; s < stars.length; s++) {
        const q = stars[s].clone().sub(C).applyMatrix4(inv);
        const dist = q.length();
        if (dist < 9 && q.z < 0) near = true;
        if (z === zEnd && q.z < -1) {
          const px = 960 + FPX * q.x / -q.z, py = 540 - FPX * q.y / -q.z;
          if (px > 40 && px < 1880 && py > 160 && py < 920) { vis++; sx += px; sy += py; sxx += px * px; syy += py * py; }
        }
      }
      if (near) break;
    }
    if (near || vis < 8) continue;
    const mx = sx / vis, my = sy / vis;
    const sdx = Math.sqrt(Math.max(0, sxx / vis - mx * mx)), sdy = Math.sqrt(Math.max(0, syy / vis - my * my));
    const spread = sdx / 1920 + sdy / 804;
    // a constellation that fills the 2.39 frame: wide horizontal spread, centred a little right of R
    // (the first star on the left golden line, the cascade opening into the frame)
    const score = vis + 60 * sdx / 1920 + 14 * sdy / 804 - 0.012 * Math.abs(mx - 900);
    if (!best || score > best.score) best = { score, vis, spread, mx, sdx, sdy, u: u.clone(), D, rot: Rm.clone() };
  }
  const q = new THREE.Quaternion().setFromRotationMatrix(best.rot);
  return { F, S, u: best.u, D0: best.D, quat: q, vis: best.vis, spread: best.spread, mx: best.mx, sdx: best.sdx, sdy: best.sdy, theta };
}

// Pose of the S09 camera at global time t.
export function firstStarPose(sol, t, zEnd = 6) {
  const z = 1 + (zEnd - 1) * Math.min(1, Math.max(0, (t - 39) / 4));
  return { pos: sol.F.clone().addScaledVector(sol.u, sol.D0 * z), quat: sol.quat, z };
}
