// Geography + camera-solving helpers shared by e_earth (S14, S18–S22A) and e_final (S40).
//
// Frames: the Earth is never rotated. World space == earth.js object space (unit radius,
// lon 0 on +Z, north on +Y, lon 90°E on +X). Cameras are solved analytically in that frame and
// described by { pos, basis (columns: right, up, back), focalMM }; the same pose drives the
// fullscreen ray-cast globe and a THREE camera for the starfield.
import * as THREE from 'three';

export const D2R = Math.PI / 180;
export const R_EARTH_KM = 6371;
export const R_GEO = [36.8, -1.3];            // anchors.R_geo (Olorgesailie / Nairobi)

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function lonLatDir(lon, lat) {
  const lo = lon * D2R, la = lat * D2R;
  return v3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}
export function dirLonLat(d) {
  return [Math.atan2(d.x, d.z) / D2R, Math.asin(Math.max(-1, Math.min(1, d.y))) / D2R];
}
// local east / north unit tangents at a unit position
export function enu(p) {
  const up = p.clone().normalize();
  let east = v3(0, 1, 0).cross(up);
  if (east.lengthSq() < 1e-12) east = v3(1, 0, 0);
  east.normalize();
  const north = up.clone().cross(east).normalize();
  return { east, north, up };
}
// point at geodesic angle `ang` (rad) from p, heading `az` (rad, 0 = north, +90° = east)
export function travel(p, az, ang) {
  const { east, north } = enu(p);
  const t = north.clone().multiplyScalar(Math.cos(az)).addScaledVector(east, Math.sin(az));
  return p.clone().normalize().multiplyScalar(Math.cos(ang)).addScaledVector(t, Math.sin(ang)).normalize();
}

// ---- hand-entered rivers (lon, lat). earth.js has none; the Nile carries the lights north (S18, S19).
export const NILE_MAIN = [
  [33.20, 0.42], [32.95, 1.45], [32.35, 1.90], [31.55, 2.30], [31.75, 3.60], [31.60, 4.85], [31.55, 6.20],
  [31.10, 7.40], [30.85, 8.60], [31.66, 9.53], [32.20, 11.20], [32.66, 13.17], [32.50, 15.60],
  [33.40, 16.70], [33.95, 17.70], [33.32, 19.53], [32.40, 18.95], [31.82, 18.48], [30.48, 19.17],
  [30.42, 20.50], [31.35, 21.80], [32.40, 22.90], [32.90, 24.09], [32.64, 25.69], [32.73, 26.16],
  [32.24, 26.05], [31.69, 26.56], [31.18, 27.18], [30.75, 28.10], [31.10, 29.07], [31.24, 30.05], [31.12, 30.20],
];
export const NILE_ROSETTA = [[31.12, 30.20], [30.98, 30.45], [30.90, 30.70], [30.78, 30.92], [30.62, 31.12], [30.50, 31.28], [30.42, 31.40], [30.36, 31.46]];
export const NILE_DAMIETTA = [[31.12, 30.20], [31.18, 30.47], [31.24, 30.68], [31.38, 30.86], [31.38, 31.04], [31.55, 31.18], [31.72, 31.33], [31.81, 31.42], [31.84, 31.50]];
export const BLUE_NILE = [[32.50, 15.60], [33.52, 14.40], [33.62, 13.55], [34.40, 11.80], [35.30, 11.20], [37.30, 12.00]];
export const SEINE = [[1.60, 49.00], [1.95, 48.92], [2.10, 48.93], [2.22, 48.88], [2.25, 48.84], [2.30, 48.86], [2.36, 48.85], [2.41, 48.82], [2.47, 48.79], [2.55, 48.70], [2.60, 48.62]];
export const RIVERS = [NILE_MAIN, NILE_ROSETTA, NILE_DAMIETTA, BLUE_NILE];

// ---- camera helpers ------------------------------------------------------------------------
export const focalPx = (W, focalMM) => (W / 2) * focalMM / 18;      // 36 mm gauge on the 16:9 canvas
// camera-space direction of pixel (px, py) (py from the top)
export function pixelDir(W, H, focalMM, px, py) {
  const f = focalPx(W, focalMM);
  return v3((px - W / 2) / f, (H / 2 - py) / f, -1).normalize();
}
// project a world point → [px, py, depth] (depth > 0 in front)
export function project(pose, W, H, p) {
  const d = p.clone().sub(pose.pos);
  const [r, u, b] = pose.cols;
  const x = d.dot(r), y = d.dot(u), z = -d.dot(b);
  const f = focalPx(W, pose.focalMM);
  return [W / 2 + f * x / z, H / 2 - f * y / z, z];
}
export function poseFromBasis(pos, r, u, b, focalMM) {
  return { pos: pos.clone(), cols: [r.clone(), u.clone(), b.clone()], focalMM };
}
// Orient a camera at `pos` so that world point `target` lands exactly on pixel (px, py) and
// `upHint` points as close to screen-up as possible (no roll beyond what the off-axis aim needs).
export function aim(pos, target, px, py, W, H, focalMM, upHint = v3(0, 1, 0)) {
  const w = target.clone().sub(pos).normalize();
  const dc = pixelDir(W, H, focalMM, px, py);         // where the target must appear (camera space)
  // camera basis B (columns r,u,b) such that B·dc = w. Start from a level camera looking along w,
  // then rotate so the view axis moves off the target by the pixel offset: yaw about up, pitch about right.
  const yaw = Math.atan2(dc.x, -dc.z), pitch = Math.asin(dc.y);
  const b0 = w.clone().negate();
  let r0 = upHint.clone().cross(b0); if (r0.lengthSq() < 1e-10) r0 = v3(1, 0, 0).cross(b0); r0.normalize();
  const u0 = b0.clone().cross(r0).normalize();
  // forward f0 = w. Undo the pitch then the yaw: the true view axis is w rotated by -pitch about r, then -yaw about u.
  const qp = new THREE.Quaternion().setFromAxisAngle(r0, -pitch);
  const r1 = r0.clone(), u1 = u0.clone().applyQuaternion(qp), b1 = b0.clone().applyQuaternion(qp);
  const qy = new THREE.Quaternion().setFromAxisAngle(u1, yaw);
  const r2 = r1.clone().applyQuaternion(qy), b2 = b1.clone().applyQuaternion(qy);
  const pose = poseFromBasis(pos, r2, u1, b2, focalMM);
  // Newton refinement (the yaw/pitch split is exact only to first order)
  for (let it = 0; it < 12; it++) {
    const [qx, qy2] = project(pose, W, H, target);
    const f = focalPx(W, focalMM);
    const ex = (qx - px) / f, ey = (qy2 - py) / f;
    if (Math.abs(ex) + Math.abs(ey) < 1e-9) break;
    const qa = new THREE.Quaternion().setFromAxisAngle(pose.cols[1], -ex);         // yaw towards the target
    const qb = new THREE.Quaternion().setFromAxisAngle(pose.cols[0], -ey);         // pitch towards
    const q = qa.multiply(qb);
    for (const c of pose.cols) c.applyQuaternion(q);
  }
  return pose;
}
// rotate a pose about its own view axis (roll) or about an arbitrary world axis through a point
export function rotatePose(pose, axis, ang, about = null) {
  const q = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), ang);
  const p = about ? pose.pos.clone().sub(about).applyQuaternion(q).add(about) : pose.pos.clone();
  return { pos: p, cols: pose.cols.map(c => c.clone().applyQuaternion(q)), focalMM: pose.focalMM };
}
// copy a pose into a THREE.PerspectiveCamera made by kit.filmCamera
export function applyPose(cam, pose) {
  const m = new THREE.Matrix4().makeBasis(pose.cols[0], pose.cols[1], pose.cols[2]);
  cam.position.copy(pose.pos);
  cam.quaternion.setFromRotationMatrix(m);
  if (Math.abs(cam.getFocalLength() - pose.focalMM) > 1e-6) cam.setFocalLength(pose.focalMM);
  cam.updateMatrixWorld(true);
}
// ray-sphere (unit sphere at origin)
export function hitSphere(o, d) {
  const b = o.dot(d), c = o.lengthSq() - 1, disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? o.clone().addScaledVector(d, t) : null;
}
export function worldRay(pose, W, H, px, py) {
  const dc = pixelDir(W, H, pose.focalMM, px, py);
  const [r, u, b] = pose.cols;
  return r.clone().multiplyScalar(dc.x).addScaledVector(u, dc.y).addScaledVector(b, dc.z).normalize();
}

// ---- S14: the horizon of anchors.arc ------------------------------------------------------
// Solved once (python least squares against anchors.arc.coef): camera distance D = 1.31907923 R⊕
// (2032.9 km altitude), Earth centre 45.92492707° below the view axis, no roll, 35 mm. The horizon
// conic of that camera reproduces anchors.arc to < 1e-6 px. Then the Earth is turned about the ray
// through R so that R_geo sits under R, with local north pointing up the screen (east → right, dawn).
export const S14_D = 1.31907923, S14_DEPRESS = 45.92492707;
export function solveS14(W, H, focalMM = 35) {
  const a = S14_DEPRESS * D2R;
  const c = v3(0, -Math.sin(a), -Math.cos(a)).multiplyScalar(S14_D);  // Earth centre, camera space
  const R = [734 * W / 1920, 540 * H / 1080];
  const dR = pixelDir(W, H, focalMM, R[0], R[1]);
  // intersect the camera-space ray with the sphere |x - c| = 1
  const b = -dR.dot(c), cc = c.lengthSq() - 1, disc = b * b - cc;
  const tHit = -b - Math.sqrt(disc);
  const hit = dR.clone().multiplyScalar(tHit);
  const nCam = hit.clone().sub(c).normalize();                  // surface normal at R (camera space)
  const g = lonLatDir(R_GEO[0], R_GEO[1]);
  const { north } = enu(g);
  // camera-space "north" at the hit must project to screen-up: choose the tangent that is
  // perpendicular to nCam and lies in the plane spanned by nCam and the image-up direction as seen there
  // (i.e. the tangent whose projection is vertical). Search the roll about nCam numerically.
  const tangentA = v3(0, 1, 0).sub(nCam.clone().multiplyScalar(nCam.y)).normalize();
  const tangentB = nCam.clone().cross(tangentA).normalize();
  let best = null;
  for (let i = 0; i < 3600; i++) {
    const ph = i / 3600 * Math.PI * 2;
    const tn = tangentA.clone().multiplyScalar(Math.cos(ph)).addScaledVector(tangentB, Math.sin(ph));
    // projected screen direction of a small step along tn from the hit
    const p2 = hit.clone().addScaledVector(tn, 1e-3);
    const s1 = [hit.x / -hit.z, hit.y / -hit.z], s2 = [p2.x / -p2.z, p2.y / -p2.z];
    const dx = s2[0] - s1[0], dy = s2[1] - s1[1];
    const score = dy / Math.hypot(dx, dy);          // 1 = straight up
    if (!best || score > best.score) best = { score, tn };
  }
  // camera-space frame at the hit (nCam, northCam = best.tn, eastCam = north × up … ) ↔ world frame (g, north, east)
  const nC = nCam, nN = best.tn, nE = nN.clone().cross(nC).normalize();          // east = north × up
  const { east } = enu(g);
  const Mc = new THREE.Matrix4().makeBasis(nE, nN, nC);       // camera-space columns
  const Mw = new THREE.Matrix4().makeBasis(east, north, g);    // world columns
  const B = Mw.clone().multiply(Mc.clone().transpose());         // camera → world rotation
  const r = v3(1, 0, 0).applyMatrix4(B), u = v3(0, 1, 0).applyMatrix4(B), bb = v3(0, 0, 1).applyMatrix4(B);
  const pos = c.clone().applyMatrix4(B).negate();               // world camera position (Earth centre at origin)
  return poseFromBasis(pos, r, u, bb, focalMM);
}
// signed pixel distance helper used by the checks: the horizon conic for a pose at distance |pos|
export function horizonY(pose, W, H, px) {
  // march down the column until the ray hits the sphere: returns the first hit row (subpixel)
  let lo = 0, hi = H;
  const hits = py => !!hitSphere(pose.pos, worldRay(pose, W, H, px, py));
  if (!hits(hi - 1)) return null;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (hits(m)) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
