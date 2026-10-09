// S09 camera solve (deterministic, no randomness).
//
//   35.0–39.0  locked 50 mm camera at C39 whose image puts
//              the first star (web.hero.first, rank 0)  exactly on R = (734, 540)      (pixel centre 734.5, 540.5)
//              the second star (rank 1, ignites 39.0)  exactly on (1086, 422)         (pixel centre 1086.5, 422.5)
//   39.0–43.0  a uniform pull-back 34.5 → 105 u from the first star on a slow arc around it (its
//              direction turns by 55°, easing in; constant speed, settling to rest over the last second)
//              with a zoom-out 50 → 24 mm (log-uniform in the same parameter): the framing scale
//              shrinks ×6.3 (the screenplay's "z 1 → 6").
//   43.0       the pose IS S10's opening pose WEB_PATH(0) (position, orientation, 24 mm). The hard cut
//              S09 → S10 is therefore concentric: every star S09 has lit sits on the same pixel in S10's
//              first frame (c_web draws S09's star layer over 43–45 and crossfades it into its own).
//
// C39 = F + D39·U39. WEB_PATH(0) looks at the first star from ≈ 55° away from any direction that can
// hold the two-star constraint with a ×6 framing change, so the pull-back is also a slow arc around
// the first star (parallax opens the constellation); U39 was chosen (offline search over 20 000
// directions, scratch solve) for the smallest camera roll on the way (2.3°), a pull-back that moves
// away from the first star monotonically, no lit star nearer than 10 u to the lens, and a framing
// change ≈ ×6. D39 is re-solved here by bisection so both stars land on their pixels exactly.
// Orientation: slerp q39 → q43, corrected every frame so the first star moves uniformly on screen
// from R to its S10 pixel M (≈ frame centre) — no roll beyond the slerp's 2.3°.
import * as THREE from 'three';
import { webPathPose, WEB } from '../_webgraph.js';

export const FOCAL = 50;                         // S09 focal length 35–39 s (zooms to WEB.focalMM by 43.0)
export const FPX = 960 / (18 / FOCAL);           // focal length in 1080p px (kit.filmCamera: 36 mm gauge)
export const R_PX = [734.5, 540.5], P2_PX = [1086.5, 422.5];
const U39 = new THREE.Vector3(-0.2403, -0.8890, 0.3897).normalize();
const camDir = (px, py, fpx = FPX) => new THREE.Vector3((px - 960) / fpx, -(py - 540) / fpx, -1).normalize();
const fpxOf = f => 960 / (18 / f);

export function solveCamera(I) {
  const { web, order } = I;
  const P = i => new THREE.Vector3(web.nodes[3 * i], web.nodes[3 * i + 1], web.nodes[3 * i + 2]);
  const F = P(order[0]), S = P(order[1]);
  const a = camDir(...R_PX), b = camDir(...P2_PX);
  const theta = a.angleTo(b);
  const angleAt = D => { const C = F.clone().addScaledVector(U39, D); return F.clone().sub(C).angleTo(S.clone().sub(C)); };
  let lo = 30, hi = 40, alo = angleAt(lo) - theta;
  for (let it = 0; it < 60; it++) { const m = 0.5 * (lo + hi), am = angleAt(m) - theta; if (am * alo > 0) { lo = m; alo = am; } else hi = m; }
  const D0 = 0.5 * (lo + hi);
  const C39 = F.clone().addScaledVector(U39, D0);
  // rotation (camera → world) with R·a = dir(F), R·b = dir(S): orthonormal triads
  const tri = (x, y) => { const e1 = x.clone(); const e3 = x.clone().cross(y).normalize(); const e2 = e3.clone().cross(e1); return new THREE.Matrix4().makeBasis(e1, e2, e3); };
  const wa = F.clone().sub(C39).normalize(), wb = S.clone().sub(C39).normalize();
  const q39 = new THREE.Quaternion().setFromRotationMatrix(tri(wa, wb).multiply(tri(a, b).transpose()));
  // S10's first frame
  const W0 = webPathPose(0);
  const C43 = W0.pos.clone();
  const m43 = new THREE.Matrix4().lookAt(W0.pos, W0.target, W0.up);
  const q43 = new THREE.Quaternion().setFromRotationMatrix(m43);
  const fc = F.clone().sub(C43).applyMatrix4(m43.clone().transpose());
  const f43 = fpxOf(WEB.focalMM);
  const M = [960 + f43 * fc.x / -fc.z, 540 - f43 * fc.y / -fc.z];
  const U43 = C43.clone().sub(F), D1 = U43.length(); U43.divideScalar(D1);
  return { F, S, D0, D1, U39: U39.clone(), U43, C39, C43, q39, q43, M, focal0: FOCAL, focal1: WEB.focalMM };
}

// Pose of the S09 camera at global time t: locked until 39.0; 39 → 43 uniform pull-back + zoom-out,
// ending exactly on WEB_PATH(0). zoom = FOCAL / focal (1 → 2.08): the stars' brightness law uses the
// framing distance d·zoom, so the fade of the stars is the same as with a pure ×6 pull-back.
const _q = new THREE.Quaternion(), _d = new THREE.Vector3(), _w = new THREE.Vector3();
// Uniform from 39.0; the last second (42–43) decelerates to rest (quadratic, C1), so S09's last frame
// f1031 is within 1/4 px of the final pose and every lit star sits on its S10 pixel across the cut
// (S10 then dollies forward at 9 u/s from its first frame: ≤ 0.4 % scale change per frame).
const EASE_T1 = 0.75, EASE_K = 1 / (EASE_T1 + (1 - EASE_T1) / 2);
const moveS = tau => (tau <= 0 ? 0 : tau >= 1 ? 1 : tau < EASE_T1 ? EASE_K * tau
  : 1 - EASE_K * (1 - EASE_T1) / 2 * Math.pow((1 - tau) / (1 - EASE_T1), 2));
export function firstStarPose(sol, t) {
  const s = moveS((t - 39) / 4);
  // an arc around the first star: its distance grows uniformly (34.5 → 105 u) while its direction
  // turns U39 → U43 (55°) with an ease-in (∝ s²): the parallax that turns the constellation then
  // starts gently after the second star's ignition and is spread over the pull-back (≤ 15 px/frame)
  const ang = sol.U39.angleTo(sol.U43), sa = s * s;
  const dir = sol.U39.clone().multiplyScalar(Math.sin((1 - sa) * ang)).addScaledVector(sol.U43, Math.sin(sa * ang)).divideScalar(Math.sin(ang));
  const pos = sol.F.clone().addScaledVector(dir.normalize(), sol.D0 + (sol.D1 - sol.D0) * s);
  const focal = sol.focal0 * Math.pow(sol.focal1 / sol.focal0, s);
  const qr = sol.q39.clone().slerp(sol.q43, s);
  // the first star moves uniformly on screen from R to M
  const px = R_PX[0] + (sol.M[0] - R_PX[0]) * s, py = R_PX[1] + (sol.M[1] - R_PX[1]) * s;
  _d.copy(camDir(px, py, fpxOf(focal))).applyQuaternion(qr);
  _w.copy(sol.F).sub(pos).normalize();
  const quat = _q.setFromUnitVectors(_d, _w).clone().multiply(qr);
  return { pos, quat, focal, zoom: sol.focal0 / focal };
}
