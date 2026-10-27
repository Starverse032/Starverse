// a_star / geo — the Earth-approach camera of A2 in the earth.js object frame (unit radius, lon 0 on +Z,
// north +Y, 90°E on +X).  The camera looks AT R_geo and a lens shift (setViewOffset, the same call as
// _clouds.js applyCamera) puts R_geo on R: moving along the line of sight keeps R the focus of expansion.
// At f1680 this camera is _clouds.js camAt(1680) (slant 87.5 km, glide 4.5°, no roll, 35 mm) expressed
// in the Earth frame: their x east / y up / z south (metres) = our east / up / −north (÷ 6 371 000).
import * as THREE from 'three';
import { slantKm, elevDeg, R_EARTH_KM, RX, RY } from './curves.js';

export const D2R = Math.PI / 180;
export const R_GEO = [36.8, -1.3];
export function lonLatDir(lon, lat) {
  const lo = lon * D2R, la = lat * D2R;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}
export function enu(p) {
  const up = p.clone().normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(up).normalize();
  const north = up.clone().cross(east).normalize();
  return { east, north, up };
}
export const G = lonLatDir(...R_GEO);
export const ENU = enu(G);
// sun: subsolar point (57°W, 0°) — 94° west of R_geo (screenplay §0)
export const SUN = lonLatDir(-57.2, 0.0);

/** camera pose at frame fr: { pos (unit-radius frame), target, up, focal } */
export function earthPose(fr) {
  const s = slantKm(fr) / R_EARTH_KM, ph = elevDeg(fr) * D2R;
  const { north, up } = ENU;
  const back = north.clone().multiplyScalar(-Math.cos(ph)).addScaledVector(up, Math.sin(ph));   // target → camera
  const pos = G.clone().addScaledVector(back, s);
  const upHint = north.clone().multiplyScalar(Math.sin(ph)).addScaledVector(up, Math.cos(ph));
  return { pos, target: G.clone(), up: upHint, focal: 35, slant: s, elev: ph };
}
/** put a THREE.PerspectiveCamera on the pose (lens shift identical to _clouds.js applyCamera) */
export function applyEarthPose(cam, pose, W, H) {
  const S = H / 1080;
  cam.filmGauge = 36; cam.aspect = W / H; cam.setFocalLength(pose.focal);
  cam.position.copy(pose.pos); cam.up.copy(pose.up); cam.lookAt(pose.target);
  const alt = pose.pos.length() - 1;
  cam.near = Math.max(1e-7, alt * 0.2); cam.far = 1e3;
  cam.setViewOffset(W, H, (960 - RX) * S, (540 - RY) * S, W, H);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  return cam;
}
/** the camera ray (unit-frame direction) through 1080p pixel (px, py), y down */
export function pixelRay(cam, px, py) {
  const v = new THREE.Vector3((px / 1920) * 2 - 1, 1 - (py / 1080) * 2, 1).applyMatrix4(cam.projectionMatrixInverse);
  return v.transformDirection(cam.matrixWorld);
}
export function hitSphere(o, d, R = 1) {
  const b = o.dot(d), c = o.lengthSq() - R * R, disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : -1;
}
/** topmost horizon y (1080p) — for checks */
export function horizonApex(cam) {
  let best = 1e9;
  for (let x = 0; x <= 1920; x += 48) {
    let lo = -2000, hi = 1080;                        // lo: no hit (sky), hi: hit
    if (hitSphere(cam.position, pixelRay(cam, x, hi)) < 0) continue;
    if (hitSphere(cam.position, pixelRay(cam, x, lo)) > 0) return -Infinity;
    for (let i = 0; i < 40; i++) { const m = 0.5 * (lo + hi); if (hitSphere(cam.position, pixelRay(cam, x, m)) > 0) hi = m; else lo = m; }
    best = Math.min(best, hi);
  }
  return best;
}
/** our frame → _clouds.js local frame (x east, y up, z south; metres, origin at R_geo) */
export function toLocalM(p) {
  const d = p.clone().sub(G).multiplyScalar(R_EARTH_KM * 1000);
  return new THREE.Vector3(d.dot(ENU.east), d.dot(ENU.up), -d.dot(ENU.north));
}
