import * as THREE from 'three';
import { MB } from './geo.js';
import { std } from './materials.js';
import { makeCanvas, CJK_SANS, CJK_SERIF, CJK_KAI, mulberry32, clamp, lerp } from './util.js';
import { nearestRoad, ROAD_Y } from './world.js';

const DARK = [0.09, 0.095, 0.105];

// ------------------------------------------------------------------ street lamps
function buildLamps(scene, data) {
  const kinds = [{ h: 6.4, arm: 1.5 }, { h: 9.6, arm: 2.6 }];
  const lists = [[], []];
  for (const l of data.lamps) lists[l[3] ? 1 : 0].push(l);
  const poleMat = std({ vertexColors: true, roughness: 0.5, metalness: 0.7 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0x555555, fog: true });
  const heads = [];
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  kinds.forEach((k, ki) => {
    const list = lists[ki];
    if (!list.length) return;
    const mb = new MB();
    mb.cyl(0, 0, 0, 0.12, 0.07, k.h, 8, DARK);
    mb.box(k.arm / 2, k.h - 0.14, 0, k.arm + 0.1, 0.09, 0.1, 0, DARK);
    mb.box(k.arm, k.h - 0.24, 0, 0.8, 0.13, 0.32, 0, [0.16, 0.165, 0.18], undefined, true);
    const pole = new THREE.InstancedMesh(mb.geometry(), poleMat, list.length);
    const hg = new THREE.PlaneGeometry(0.66, 0.24);
    hg.rotateX(Math.PI / 2);
    hg.translate(k.arm, k.h - 0.245, 0);
    const head = new THREE.InstancedMesh(hg, headMat, list.length);
    list.forEach((l, i) => {
      p.set(l[0], 0, l[1]);
      q.setFromAxisAngle(yAxis, -l[2]);
      m4.compose(p, q, s);
      pole.setMatrixAt(i, m4);
      head.setMatrixAt(i, m4);
      heads.push({ x: l[0] + Math.cos(l[2]) * k.arm, y: k.h - 0.3, z: l[1] + Math.sin(l[2]) * k.arm, r: k.h * 1.55 });
    });
    pole.castShadow = true;
    pole.receiveShadow = true;
    pole.computeBoundingSphere();
    head.computeBoundingSphere();
    group.add(pole, head);
  });

  // pools of light on the ground (additive decals) — cheap stand-ins for hundreds of real lights
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.42)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const glowTex = new THREE.CanvasTexture(c);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, fog: true,
  });
  const gg = new THREE.PlaneGeometry(2, 2);
  gg.rotateX(-Math.PI / 2);
  const glow = new THREE.InstancedMesh(gg, glowMat, heads.length);
  heads.forEach((h, i) => {
    p.set(h.x, 0.04, h.z);
    q.identity();
    s.set(h.r, 1, h.r);
    m4.compose(p, q, s);
    glow.setMatrixAt(i, m4);
  });
  glow.computeBoundingSphere();
  glow.renderOrder = 2;
  glow.visible = false;
  group.add(glow);

  // a handful of real lights that hop to the lamps nearest the player
  const lights = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xffc98a, 0, 30, 1.7);
    l.castShadow = false;
    scene.add(l);
    lights.push(l);
  }
  scene.add(group);
  let timer = 0;
  const update = (dt, night, focus) => {
    const k = lerp(0.35, 11, night);
    headMat.color.setRGB(1.0 * k, 0.8 * k, 0.52 * k);
    glowMat.opacity = night * 0.34;
    glow.visible = night > 0.02;
    timer -= dt;
    if (timer <= 0 && focus) {
      timer = 0.35;
      const near = [];
      for (const h of heads) {
        const d = (h.x - focus.x) ** 2 + (h.z - focus.z) ** 2;
        if (d < 80 * 80) near.push([d, h]);
      }
      near.sort((a, b) => a[0] - b[0]);
      lights.forEach((l, i) => {
        if (near[i]) { l.position.set(near[i][1].x, near[i][1].y - 0.3, near[i][1].z); l.userData.on = 1; } else l.userData.on = 0;
      });
    }
    for (const l of lights) l.intensity = night * 150 * (l.userData.on || 0);
  };
  return { update, heads };
}

// ------------------------------------------------------------------ name signs
function buildSigns(scene, signs) {
  const mats = [];
  for (const s of signs) {
    const n = s.text.length;
    const H = 192, W = Math.max(256, n * 176 + 48);
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let fill = '#e6c36a', stroke = 'rgba(60,40,10,0.9)', font = `900 148px ${CJK_SANS}`;
    if (s.gate && s.big) { fill = '#b3141c'; stroke = 'rgba(70,0,0,0.6)'; font = `900 160px ${CJK_KAI}`; }
    else if (s.gate) { fill = '#2c2c30'; stroke = 'rgba(0,0,0,0.5)'; font = `700 132px ${CJK_SERIF}`; }
    g.font = font;
    g.lineWidth = 5;
    g.strokeStyle = stroke;
    g.fillStyle = fill;
    const step = (W - 48) / n;
    for (let i = 0; i < n; i++) {
      const x = 24 + step * (i + 0.5);
      g.strokeText(s.text[i], x, H / 2 + 4);
      g.fillText(s.text[i], x, H / 2 + 4);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = std({
      map: tex, transparent: true, alphaTest: 0.3, roughness: 0.45, metalness: s.gate ? 0.1 : 0.55,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, side: THREE.DoubleSide,
    });
    mat.userData.glow = s.gate ? 0.5 : 1.5;
    mats.push(mat);
    const w = s.width, h = (w * H) / W;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(s.x + s.nx * 0.14, s.y, s.z + s.nz * 0.14);
    m.rotation.y = Math.atan2(s.nx, s.nz);
    m.castShadow = false;
    m.receiveShadow = true;
    scene.add(m);
  }
  return (night) => { for (const m of mats) m.emissiveIntensity = night * m.userData.glow; };
}

// ------------------------------------------------------------------ sports equipment & street furniture
function buildFurniture(scene, world) {
  const mb = new MB();
  const white = [0.92, 0.92, 0.9];
  const post = (x, y, z, h, r = 0.06, c = white) => mb.cyl(x, y, z, r, r, h, 8, c);
  for (const gl of world.props.goals) {
    const dx = Math.cos(gl.a), dz = Math.sin(gl.a);      // outward
    const px = -dz, pz = dx;
    const [x, , z] = gl.p;
    const hw = gl.w / 2;
    post(x + px * hw, 0, z + pz * hw, gl.h);
    post(x - px * hw, 0, z - pz * hw, gl.h);
    mb.box(x, gl.h - 0.06, z, 0.12, 0.12, gl.w + 0.12, Math.atan2(dz, dx), white, undefined, true);
    // back frame + a translucent-looking net of thin bars
    const bx = x + dx * 1.5, bz = z + dz * 1.5;
    post(bx + px * hw, 0, bz + pz * hw, gl.h * 0.6, 0.03, [0.7, 0.7, 0.7]);
    post(bx - px * hw, 0, bz - pz * hw, gl.h * 0.6, 0.03, [0.7, 0.7, 0.7]);
    mb.box(bx, gl.h * 0.6 - 0.03, bz, 0.05, 0.05, gl.w, Math.atan2(dz, dx), [0.7, 0.7, 0.7], undefined, true);
  }
  for (const h of world.props.hoops) {
    const dx = Math.cos(h.a), dz = Math.sin(h.a);        // towards the court
    const [x, , z] = h.p;
    const ang = Math.atan2(dz, dx);
    post(x, 0, z, 3.0, 0.09, [0.1, 0.2, 0.42]);
    mb.box(x + dx * 0.8, 2.95, z + dz * 0.8, 1.7, 0.12, 0.12, ang, [0.1, 0.2, 0.42], undefined, true);
    mb.box(x + dx * 1.65, 2.75, z + dz * 1.65, 0.05, 1.05, 1.8, ang, [0.93, 0.93, 0.95], undefined, true);
    // rim
    const rx = x + dx * 1.95, rz = z + dz * 1.95;
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      const mx = rx + (Math.cos(a0) + Math.cos(a1)) * 0.115, mz = rz + (Math.sin(a0) + Math.sin(a1)) * 0.115;
      mb.box(mx, 3.03, mz, 0.03, 0.03, 0.13, (a0 + a1) / 2, [0.9, 0.32, 0.08], undefined, true);
    }
  }
  for (const n of world.props.nets) {
    const ax = n.a[0], az = n.a[2], bx = n.b[0], bz = n.b[2];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    post(ax, 0, az, 1.07, 0.04, [0.15, 0.15, 0.15]);
    post(bx, 0, bz, 1.07, 0.04, [0.15, 0.15, 0.15]);
    mb.box((ax + bx) / 2, 0.15, (az + bz) / 2, len, 0.82, 0.02, ang, [0.12, 0.13, 0.12], undefined, true);
    mb.box((ax + bx) / 2, 0.97, (az + bz) / 2, len, 0.06, 0.03, ang, white, undefined, true);
  }
  // bus shelters
  for (const q of world.data.pois) {
    if (q.k !== 'bus') continue;
    const r = nearestRoad(q.x, q.z, 14);
    if (!r) continue;
    let nx = -r.uz, nz = r.ux;
    if (nx * (q.x - r.x) + nz * (q.z - r.z) < 0) { nx = -nx; nz = -nz; }
    const cx = r.x + nx * (r.w / 2 + 2.0), cz = r.z + nz * (r.w / 2 + 2.0);
    const ang = Math.atan2(r.uz, r.ux);
    mb.box(cx, 2.45, cz, 5.2, 0.1, 1.7, ang, [0.2, 0.22, 0.25], undefined, true);
    mb.box(cx + nx * 0.75, 0.0, cz + nz * 0.75, 5.0, 2.45, 0.06, ang, [0.35, 0.5, 0.58]);
    mb.box(cx + nx * 0.2, 0.42, cz + nz * 0.2, 3.2, 0.06, 0.42, ang, [0.45, 0.33, 0.2], undefined, true);
    for (const e of [-2.5, 2.5]) post(cx + r.ux * e + nx * 0.7, 0, cz + r.uz * e + nz * 0.7, 2.45, 0.05, [0.2, 0.22, 0.25]);
  }
  if (!mb.count) return;
  const m = new THREE.Mesh(mb.geometry(), std({ vertexColors: true, roughness: 0.55, metalness: 0.2 }));
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
}

// ------------------------------------------------------------------ aircraft warning lights
function buildBeacons(scene, beacons) {
  if (!beacons.length) return () => {};
  const mat = new THREE.MeshBasicMaterial({ color: 0x400000 });
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), mat, beacons.length);
  const m4 = new THREE.Matrix4();
  beacons.forEach((b, i) => { m4.makeTranslation(b[0], b[1], b[2]); im.setMatrixAt(i, m4); });
  im.computeBoundingSphere();
  scene.add(im);
  return (time, night) => {
    const blink = Math.pow(Math.max(0, Math.sin(time * 2.2)), 6);
    const k = 0.25 + (0.6 + 9 * night) * blink;
    mat.color.setRGB(k, 0.03 * k, 0.02 * k);
  };
}

// ------------------------------------------------------------------ traffic
function buildTraffic(scene, data, q) {
  const routes = [];
  for (const r of data.roads) {
    if (!['primary', 'secondary', 'tertiary'].includes(r.k)) continue;
    const pts = [];
    for (let i = 0; i < r.p.length; i += 2) pts.push([r.p[i], r.p[i + 1]]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1];
    if (len < 70) continue;
    routes.push({ pts, cum, len, w: r.w, ow: r.ow });
  }
  const rnd = mulberry32(555);
  const cars = [];
  const palette = [[0.85, 0.85, 0.86], [0.06, 0.06, 0.07], [0.5, 0.52, 0.55], [0.55, 0.05, 0.05], [0.1, 0.25, 0.55], [0.08, 0.38, 0.72], [0.9, 0.9, 0.9], [0.3, 0.3, 0.32], [0.75, 0.6, 0.1]];
  for (const r of routes) {
    const n = Math.max(1, Math.floor((r.len / 60) * q.traffic));
    for (let i = 0; i < n; i++) {
      const fwd = r.ow ? true : rnd() < 0.5;
      const lanes = r.ow ? Math.max(1, Math.round((r.w - 1) / 3.5)) : 1;
      const lane = Math.floor(rnd() * lanes);
      const off = r.ow ? -r.w / 2 + 0.5 + ((r.w - 1) * (lane + 0.5)) / lanes : (r.w / 4) * 1;
      cars.push({ r, s: rnd() * r.len, v: (8 + rnd() * 7) * (fwd ? 1 : -1), off: r.ow ? off : (fwd ? off : -off), seg: 0, bus: rnd() < 0.07 });
    }
  }
  const N = cars.length;
  if (!N) return () => {};
  const body = new MB(), lamp = new MB();
  body.box(0, 0.28, 0, 4.35, 0.62, 1.78, 0, [1, 1, 1], undefined, true);
  body.box(-0.15, 1.38, 0, 2.3, 0.05, 1.46, 0, [1, 1, 1]);
  // cabin as a slightly tapered dark block
  const gb = new MB();
  gb.box(-0.15, 0.88, 0, 2.6, 0.5, 1.58, 0, [0.035, 0.045, 0.055], undefined, true);
  const wheels = new MB();
  for (const [wx, wz] of [[1.35, 0.82], [1.35, -0.82], [-1.35, 0.82], [-1.35, -0.82]]) wheels.box(wx, 0, wz, 0.62, 0.62, 0.24, 0, [0.02, 0.02, 0.02], undefined, true);
  lamp.box(2.17, 0.55, 0.6, 0.04, 0.14, 0.34, 0, [1, 0.95, 0.8], undefined, true);
  lamp.box(2.17, 0.55, -0.6, 0.04, 0.14, 0.34, 0, [1, 0.95, 0.8], undefined, true);
  lamp.box(-2.17, 0.6, 0.62, 0.04, 0.12, 0.32, 0, [1, 0.04, 0.02], undefined, true);
  lamp.box(-2.17, 0.6, -0.62, 0.04, 0.12, 0.32, 0, [1, 0.04, 0.02], undefined, true);
  const bodyMat = std({ vertexColors: true, roughness: 0.32, metalness: 0.55 });
  const cabMat = std({ vertexColors: true, roughness: 0.08, metalness: 0.85 });
  const wheelMat = std({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const mk = (geo, mat, shadow) => {
    const im = new THREE.InstancedMesh(geo, mat, N);
    im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
    return im;
  };
  const meshes = [mk(body.geometry(), bodyMat, true), mk(gb.geometry(), cabMat, true), mk(wheels.geometry(), wheelMat, false), mk(lamp.geometry(), lampMat, false)];
  const col = new THREE.Color();
  cars.forEach((c, i) => {
    const p = c.bus ? [0.1, 0.45, 0.75] : palette[Math.floor(rnd() * palette.length)];
    col.setRGB(p[0], p[1], p[2]);
    meshes[0].setColorAt(i, col);
  });
  meshes[0].instanceColor.needsUpdate = true;
  const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const state = { cars };
  const update = (dt, night) => {
    for (let i = 0; i < N; i++) {
      const c = cars[i], r = c.r;
      c.s += c.v * dt;
      if (c.s > r.len) c.s -= r.len; else if (c.s < 0) c.s += r.len;
      let k = c.seg;
      while (k < r.cum.length - 2 && r.cum[k + 1] < c.s) k++;
      while (k > 0 && r.cum[k] > c.s) k--;
      c.seg = k;
      const a = r.pts[k], b = r.pts[k + 1];
      const sl = r.cum[k + 1] - r.cum[k] || 1;
      const t = (c.s - r.cum[k]) / sl;
      let dx = (b[0] - a[0]) / sl, dz = (b[1] - a[1]) / sl;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const dirS = c.v >= 0 ? 1 : -1;
      // drive on the right
      const ox = -dz * c.off, oz = dx * c.off;
      c.x = x + ox; c.z = z + oz;
      pos.set(c.x, ROAD_Y, c.z);
      quat.setFromAxisAngle(yAxis, -Math.atan2(dz * dirS, dx * dirS));
      if (c.bus) scl.set(2.5, 1.9, 1.3); else scl.set(1, 1, 1);
      m4.compose(pos, quat, scl);
      for (const m of meshes) m.setMatrixAt(i, m4);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    const k = lerp(0.5, 7, night);
    lampMat.color.setRGB(k, k, k);
  };
  update(0, 0);
  return Object.assign(update, state);
}

export function buildProps(scene, world, q) {
  const lamps = buildLamps(scene, world.data);
  const signGlow = buildSigns(scene, world.signs);
  buildFurniture(scene, world);
  const beacon = buildBeacons(scene, world.beacons);
  const traffic = buildTraffic(scene, world.data, q);
  return {
    lamps,
    traffic,
    update(dt, time, night, focus) {
      lamps.update(dt, night, focus);
      signGlow(night);
      beacon(time, night);
      traffic(dt, night);
    },
  };
}
void clamp;
