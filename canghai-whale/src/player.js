import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, smoothstep } from './util.js';

export const GRAV = 27;
const R = 0.34;            // capsule radius
const HGT = 1.6;           // capsule height (feet -> crown)
const CHEST = 1.05;        // rope / wall probe height above the feet
const WALK = 3.0, RUN = 7.2, SPRINT = 12.0;
const JUMP = 9.6, AIRJUMP = 9.2;
const CLIMB = 5.4, CLIMB_FAST = 9.6;
const ROPE_MAX = 105, ROPE_MIN = 5;
const ZIP_MAX = 150, ZIP_SPEED = 52;

const UP = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _seg = new THREE.Line3();
const _box = new THREE.Box3();
const _ray = new THREE.Ray();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _look = new THREE.Vector3();

/**
 * Kinematic capsule controller with four traversal modes:
 * running, wall climbing, rope swinging (a true pendulum constraint) and zip-lining to a surface.
 */
export class Player {
  constructor(world, veg, girl, camera, audio) {
    this.bvh = world.bvh;
    this.veg = veg;
    this.girl = girl;
    this.camera = camera;
    this.audio = audio;
    this.bounds = world.data.world;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.mode = 'air';
    this.yaw = 0;                       // facing of the body
    this.grounded = false;
    this.groundN = new THREE.Vector3(0, 1, 0);
    this.wallN = new THREE.Vector3();
    this.hasWall = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.airJumps = 1;
    this.climbLock = 0;                 // time before the player may grab a wall again
    this.lastVy = 0;
    this.airTime = 0;
    this.stepT = 0;

    this.rope = { active: false, anchor: new THREE.Vector3(), len: 0, t: 0, fade: 0, hand: new THREE.Vector3(), tip: new THREE.Vector3() };
    this.zip = { active: false, target: new THREE.Vector3(), normal: new THREE.Vector3(), wall: false, t: 0, cool: 0 };
    this.preview = { swing: null, zip: null, t: 0 };
    this.stats = { swings: 0, maxSpeed: 0, maxAlt: 0, dist: 0 };

    // camera rig
    this.camYaw = 0;
    this.camPitch = -0.12;
    this.camDist = 5;
    this.camTarget = new THREE.Vector3();
    this.camRoll = 0;
    this.shake = 0;
    this.fov = 60;

    // visual rig: the character pivots around her chest while swinging
    this.rig = new THREE.Group();
    this.rig.add(girl.root);
    girl.root.position.y = -CHEST;
    this.rigQuat = new THREE.Quaternion();

    // rope mesh
    const rg = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    rg.translate(0, 0.5, 0);
    this.ropeMesh = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.95, 2.2), transparent: true, opacity: 1, fog: false }));
    this.ropeMesh.frustumCulled = false;
    this.ropeMesh.visible = false;
    this.knot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3.0), fog: false }));
    this.knot.visible = false;

    this.events = [];                   // consumed by the game loop (sounds, fx)
  }

  addTo(scene) {
    scene.add(this.rig, this.ropeMesh, this.knot);
  }

  spawn(x, y, z, yaw = 0) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.mode = 'air';
    this.yaw = yaw;
    this.camYaw = yaw + Math.PI;
    this.camPitch = -0.1;
    this.rope.active = false;
    this.zip.active = false;
    this.camTarget.copy(this.pos).y += 1.3;
    this._placeCamera(1, true);
  }

  // ------------------------------------------------------------------ queries
  raycast(origin, dir, far, near = 0) {
    _ray.origin.copy(origin);
    _ray.direction.copy(dir);
    return this.bvh.raycastFirst(_ray, THREE.DoubleSide, near, far);
  }

  _hitNormal(hit, dir, target) {
    target.copy(hit.face.normal);
    if (target.dot(dir) > 0) target.multiplyScalar(-1);
    return target;
  }

  /** push the capsule out of the world; returns true if anything was touched */
  _collide() {
    const p = this.pos;
    _seg.start.set(p.x, p.y + R, p.z);
    _seg.end.set(p.x, p.y + HGT - R, p.z);
    _box.makeEmpty();
    _box.expandByPoint(_seg.start);
    _box.expandByPoint(_seg.end);
    _box.min.addScalar(-R);
    _box.max.addScalar(R);
    let hit = false;
    let bestUp = 0.5, bestWall = 0;
    const gn = this.groundN, wn = this.wallN;
    let grounded = false, wall = false;
    const sx = _seg.start.x, sy = _seg.start.y, sz = _seg.start.z;
    this.bvh.shapecast({
      intersectsBounds: (b) => b.intersectsBox(_box),
      intersectsTriangle: (tri) => {
        const d = tri.closestPointToSegment(_seg, _v1, _v2);
        if (d < R) {
          const depth = R - d;
          _v3.subVectors(_v2, _v1);
          const l = _v3.length();
          if (l < 1e-6) tri.getNormal(_v3); else _v3.multiplyScalar(1 / l);
          _seg.start.addScaledVector(_v3, depth);
          _seg.end.addScaledVector(_v3, depth);
          hit = true;
          if (_v3.y > bestUp) { bestUp = _v3.y; gn.copy(_v3); grounded = true; }
          if (Math.abs(_v3.y) < 0.35 && depth > bestWall) { bestWall = depth; wn.set(_v3.x, 0, _v3.z).normalize(); wall = true; }
          // slide: remove the velocity component going into the surface
          const vn = this.vel.dot(_v3);
          if (vn < 0) this.vel.addScaledVector(_v3, -vn);
        }
        return false;
      },
    });
    p.x += _seg.start.x - sx;
    p.y += _seg.start.y - sy;
    p.z += _seg.start.z - sz;
    this._touchGround = grounded;
    this._touchWall = wall;
    return hit;
  }

  _collideTrees() {
    const p = this.pos;
    const list = this.veg.near(p.x, p.z, 2.5, this._treeBuf || (this._treeBuf = []));
    for (const t of list) {
      if (p.y > t.h * 0.42) continue;
      const dx = p.x - t.x, dz = p.z - t.z;
      const d = Math.hypot(dx, dz), min = t.r + R;
      if (d < min && d > 1e-4) {
        const k = (min - d) / d;
        p.x += dx * k; p.z += dz * k;
        const nx = dx / d, nz = dz / d;
        const vn = this.vel.x * nx + this.vel.z * nz;
        if (vn < 0) { this.vel.x -= nx * vn; this.vel.z -= nz * vn; }
      }
    }
  }

  // ------------------------------------------------------------------ anchors
  /** find the best point to attach a swing line */
  findSwingAnchor(aimDir) {
    const p = this.pos;
    const o = _v4.set(p.x, p.y + 1.45, p.z);
    let best = null, bestScore = -1e9;
    // 1) exactly what the player is looking at
    const cam = this.camera;
    cam.getWorldDirection(_v1);
    let h = this.raycast(cam.position, _v1, ROPE_MAX + this.camDist, this.camDist * 0.6);
    if (h) {
      const d = h.point.distanceTo(o);
      if (h.point.y - p.y > 3.5 && d > ROPE_MIN && d < ROPE_MAX) return { point: h.point.clone(), dist: d, aimed: true };
    }
    // 2) sweep a fan of rays ahead and above
    const hs = Math.hypot(this.vel.x, this.vel.z);
    let fx = aimDir.x, fz = aimDir.z;
    if (hs > 4) { fx = fx * 0.55 + (this.vel.x / hs) * 0.45; fz = fz * 0.55 + (this.vel.z / hs) * 0.45; }
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
    const base = Math.atan2(fz, fx);
    for (const el of EL) {
      const ce = Math.cos(el), se = Math.sin(el);
      for (const az of AZ) {
        const a = base + az;
        _v1.set(Math.cos(a) * ce, se, Math.sin(a) * ce);
        h = this.raycast(o, _v1, ROPE_MAX, 4);
        if (!h) continue;
        const d = h.distance;
        const rise = h.point.y - o.y;
        if (rise < 4 || d < 9) continue;
        let s = 1 - (Math.abs(az) / 2.1) * 0.7 - Math.abs(d - 36) / 85 - Math.abs(el - 0.85) * 0.45;
        const aa = Math.abs(az);
        if (aa > 0.25 && aa < 0.9) s += 0.18;          // side anchors give a clear arc
        if (rise > 12) s += 0.1;
        // a wall squarely across the path means a face-plant at the bottom of the arc: prefer walls
        // that run alongside the direction of travel, roof edges and overhead structures
        const hn = this._hitNormal(h, _v1, _v2);
        const facing = -(hn.x * fx + hn.z * fz);
        if (facing > 0.35 && Math.abs(hn.y) < 0.5) s -= (facing - 0.35) * 1.5;
        if (s > bestScore) { bestScore = s; best = { point: h.point.clone(), dist: d, aimed: false }; }
      }
    }
    // 3) tree crowns
    const list = this.veg.near(p.x + fx * 22, p.z + fz * 22, 34, this._treeBuf2 || (this._treeBuf2 = []));
    for (const t of list) {
      const ty = t.cy + t.cr * 0.25;
      if (ty - o.y < 3.5) continue;
      const dx = t.x - o.x, dz = t.z - o.z;
      const dh = Math.hypot(dx, dz);
      if (dh < 5 || dh > 40) continue;
      const ahead = (dx * fx + dz * fz) / dh;
      if (ahead < 0.25) continue;
      const s = 0.25 + ahead * 0.3 - Math.abs(dh - 16) / 60;
      if (s > bestScore) { bestScore = s; best = { point: new THREE.Vector3(t.x, ty, t.z), dist: Math.hypot(dh, ty - o.y), aimed: false }; }
    }
    return best;
  }

  findZipTarget() {
    const cam = this.camera;
    cam.getWorldDirection(_v1);
    const h = this.raycast(cam.position, _v1, ZIP_MAX, this.camDist * 0.7);
    if (!h) return null;
    const n = this._hitNormal(h, _v1, new THREE.Vector3());
    const d = h.point.distanceTo(this.pos);
    if (d < 4) return null;
    return { point: h.point.clone(), normal: n, dist: d };
  }

  // ------------------------------------------------------------------ actions
  startSwing(aimDir) {
    const a = this.findSwingAnchor(aimDir);
    if (!a) { this.events.push({ type: 'noanchor' }); return false; }
    const r = this.rope;
    r.active = true;
    r.anchor.copy(a.point);
    _v1.set(this.pos.x, this.pos.y + CHEST, this.pos.z);
    r.len = clamp(_v1.distanceTo(a.point), ROPE_MIN, ROPE_MAX);
    r.t = 0;
    r.fade = 1;
    if (this.mode === 'ground' || this.mode === 'climb') {
      // hop off the surface so the pendulum has room
      if (this.mode === 'climb') this.vel.copy(this.wallN).multiplyScalar(5).setY(4.5);
      else this.vel.y = Math.max(this.vel.y, 6.5);
      this.climbLock = 0.35;
    }
    this.mode = 'swing';
    this.zip.active = false;
    this.grounded = false;
    this.stats.swings++;
    this.events.push({ type: 'thwip' });
    return true;
  }

  releaseSwing(jump = false) {
    if (!this.rope.active) return;
    this.rope.active = false;
    if (this.mode !== 'swing') return;
    this.mode = 'air';
    const v = this.vel;
    v.x *= 1.07; v.z *= 1.07;
    if (v.y > -2) v.y += jump ? 6.5 : 2.4;
    if (jump) { v.x *= 1.08; v.z *= 1.08; this.events.push({ type: 'jump' }); }
    this.airJumps = 1;
    this.events.push({ type: 'release' });
  }

  startZip() {
    if (this.zip.cool > 0) return false;
    const t = this.findZipTarget();
    if (!t) { this.events.push({ type: 'noanchor' }); return false; }
    const z = this.zip;
    z.active = true;
    z.t = 0;
    z.wall = Math.abs(t.normal.y) < 0.5;
    z.normal.copy(t.normal);
    if (z.wall) {
      z.target.copy(t.point).addScaledVector(t.normal, R + 0.06).y -= CHEST;
      _v1.copy(z.target).y += CHEST;
      const fl = this.raycast(_v1, DOWN, CHEST + 0.5);
      if (fl) z.target.y = Math.max(z.target.y, fl.point.y + 0.08);
    } else if (t.normal.y > 0) z.target.copy(t.point).y += 0.1;
    else z.target.copy(t.point).y -= HGT + 0.2;
    this.rope.active = true;
    this.rope.anchor.copy(t.point);
    this.rope.t = 0;
    this.rope.fade = 1;
    this.rope.len = t.dist;
    this.mode = 'zip';
    this.grounded = false;
    this.events.push({ type: 'thwip' });
    return true;
  }

  // ------------------------------------------------------------------ main update
  update(dt, input) {
    const steps = clamp(Math.ceil((this.vel.length() * dt) / (R * 0.8)), 1, 10);
    const h = dt / steps;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if (input.jumpPressed) this.jumpBuf = 0.14;
    this.climbLock = Math.max(0, this.climbLock - dt);
    this.zip.cool = Math.max(0, this.zip.cool - dt);

    // camera-relative move direction
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    const fwdX = -sy, fwdZ = -cy;                 // camera forward on the ground plane
    const rgtX = cy, rgtZ = -sy;
    let mx = fwdX * input.my + rgtX * input.mx, mz = fwdZ * input.my + rgtZ * input.mx;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    this.moveX = mx; this.moveZ = mz; this.moveLen = Math.min(1, ml);
    this.aim = this.aim || new THREE.Vector3();
    this.aim.set(fwdX, 0, fwdZ);

    // edge-triggered actions
    if (input.swingPressed && this.mode !== 'zip') this.startSwing(this.aim);
    if (!input.swingHeld && this.rope.active && this.mode === 'swing') this.releaseSwing(false);
    if (input.zipPressed && this.mode !== 'zip') {
      if (this.mode === 'swing') { this.rope.active = false; this.mode = 'air'; }
      this.startZip();
    }

    const startPos = _v4.copy(this.pos);
    for (let i = 0; i < steps; i++) {
      this.lastVy = this.vel.y;
      if (this.mode === 'ground') this._stepGround(h, input);
      else if (this.mode === 'air') this._stepAir(h, input);
      else if (this.mode === 'climb') this._stepClimb(h, input);
      else if (this.mode === 'swing') this._stepSwing(h, input);
      else if (this.mode === 'zip') this._stepZip(h, input);
    }
    // world limits
    const b = this.bounds;
    if (this.pos.x < b[0] + 3) { this.pos.x = b[0] + 3; this.vel.x = Math.max(0, this.vel.x); this.events.push({ type: 'edge' }); }
    if (this.pos.x > b[2] - 3) { this.pos.x = b[2] - 3; this.vel.x = Math.min(0, this.vel.x); this.events.push({ type: 'edge' }); }
    if (this.pos.z < b[1] + 3) { this.pos.z = b[1] + 3; this.vel.z = Math.max(0, this.vel.z); this.events.push({ type: 'edge' }); }
    if (this.pos.z > b[3] - 3) { this.pos.z = b[3] - 3; this.vel.z = Math.min(0, this.vel.z); this.events.push({ type: 'edge' }); }
    if (this.pos.y < -3) { this.pos.y = 1; this.vel.set(0, 0, 0); }
    if (this.pos.y > 700) this.vel.y = Math.min(this.vel.y, 0);

    const sp = this.vel.length();
    this.speed = sp;
    this.stats.maxSpeed = Math.max(this.stats.maxSpeed, sp);
    this.stats.maxAlt = Math.max(this.stats.maxAlt, this.pos.y);
    this.stats.dist += startPos.distanceTo(this.pos);

    this._updateVisual(dt, input);
    this._updateCamera(dt, input);
    this._updateRope(dt);

    // anchor preview for the HUD (a few times per second)
    this.preview.t -= dt;
    if (this.preview.t <= 0) {
      this.preview.t = 0.08;
      this.preview.swing = this.mode === 'swing' || this.mode === 'zip' ? null : this.findSwingAnchor(this.aim);
      this.preview.zip = this.mode === 'zip' ? null : this.findZipTarget();
    }
  }

  // ------------------------------------------------------------------ ground
  _stepGround(h, input) {
    const v = this.vel;
    const sprint = input.sprint;
    const target = (sprint ? SPRINT : input.walk ? WALK : RUN) * this.moveLen;
    const tx = this.moveX * target / (this.moveLen || 1), tz = this.moveZ * target / (this.moveLen || 1);
    const acc = this.moveLen > 0.01 ? 58 : 46;
    const dx = tx - v.x, dz = tz - v.z;
    const dl = Math.hypot(dx, dz);
    const mv = acc * h;
    if (dl <= mv) { v.x = tx; v.z = tz; } else { v.x += (dx / dl) * mv; v.z += (dz / dl) * mv; }
    // follow the ground plane; a little downward speed keeps the feet planted on ramps
    v.y = -2.5 - Math.max(0, (v.x * this.groundN.x + v.z * this.groundN.z) / Math.max(0.3, this.groundN.y));

    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      v.y = JUMP + (sprint ? 0.9 : 0);
      this.mode = 'air';
      this.grounded = false;
      this.coyote = 0;
      this.airJumps = 1;
      this.events.push({ type: 'jump' });
      this.pos.addScaledVector(v, h);
      return;
    }
    // step up kerbs and other low ledges instead of bumping into them
    const hs0 = Math.hypot(v.x, v.z);
    if (hs0 > 0.5) {
      _v1.set(this.pos.x + (v.x / hs0) * (R + 0.14), this.pos.y + 0.56, this.pos.z + (v.z / hs0) * (R + 0.14));
      const st = this.raycast(_v1, DOWN, 0.54);
      if (st && Math.abs(st.face.normal.y) > 0.7) {
        const dy = st.point.y - this.pos.y;
        if (dy > 0.04 && dy < 0.5) this.pos.y = st.point.y + 0.012;
      }
    }
    this.pos.addScaledVector(v, h);
    this._collide();
    this._collideTrees();

    if (this._touchGround) {
      this.coyote = 0.12;
      this.grounded = true;
    } else {
      // snap down small steps, otherwise start falling
      _v1.set(this.pos.x, this.pos.y + 0.4, this.pos.z);
      const hit = this.raycast(_v1, DOWN, 0.4 + 0.45);
      if (hit && hit.face.normal.y * Math.sign(hit.face.normal.y) > 0.5) {
        this.pos.y = hit.point.y;
        this.groundN.copy(hit.face.normal);
        if (this.groundN.y < 0) this.groundN.multiplyScalar(-1);
      } else {
        this.coyote -= h;
        if (this.coyote <= 0) { this.mode = 'air'; this.grounded = false; v.y = Math.max(v.y, -1); }
      }
    }
    // low obstacle ahead -> vault; tall wall + pushing into it -> climb
    if (this._touchWall && this.moveLen > 0.3) {
      const into = -(this.moveX * this.wallN.x + this.moveZ * this.wallN.z);
      if (into > 0.45) {
        _v1.set(this.pos.x - this.wallN.x * (R + 0.45), this.pos.y + 2.1, this.pos.z - this.wallN.z * (R + 0.45));
        const top = this.raycast(_v1, DOWN, 2.0);
        if (top && top.point.y - this.pos.y > 0.3 && top.point.y - this.pos.y < 1.55) {
          const hgt = top.point.y - this.pos.y;
          v.y = Math.sqrt(2 * GRAV * (hgt + 0.35));
          const keep = Math.max(4.5, Math.hypot(v.x, v.z));
          v.x = this.moveX * keep; v.z = this.moveZ * keep;
          this.mode = 'air';
          this.grounded = false;
          this.climbLock = 0.3;
          this.events.push({ type: 'vault' });
        } else if (this.climbLock <= 0 && this._probeWall(this.wallN)) {
          this._enterClimb();
        }
      }
    }
    // footsteps
    const hs = Math.hypot(v.x, v.z);
    if (hs > 1) {
      this.stepT -= h * hs;
      if (this.stepT <= 0) { this.stepT = sprint ? 2.3 : 1.7; this.events.push({ type: 'step', k: clamp(hs / SPRINT, 0.3, 1) }); }
    }
  }

  // ------------------------------------------------------------------ air
  _stepAir(h, input) {
    const v = this.vel;
    v.y -= GRAV * h;
    if (v.y < -80) v.y = -80;
    // air control
    if (this.moveLen > 0.01) {
      const hs = Math.hypot(v.x, v.z);
      const maxS = Math.max(RUN, hs);
      const ax = this.moveX * 20 * h, az = this.moveZ * 20 * h;
      let nx = v.x + ax, nz = v.z + az;
      const nl = Math.hypot(nx, nz);
      if (nl > maxS) { nx *= maxS / nl; nz *= maxS / nl; }
      v.x = nx; v.z = nz;
    }
    v.x *= 1 - 0.05 * h; v.z *= 1 - 0.05 * h;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.jumpBuf = 0; this.coyote = 0;
      v.y = JUMP;
      this.events.push({ type: 'jump' });
    } else if (this.jumpBuf > 0 && this.airJumps > 0) {
      this.jumpBuf = 0;
      this.airJumps--;
      v.y = Math.max(v.y * 0.3, 0) + AIRJUMP;
      const hs = Math.hypot(v.x, v.z);
      if (this.moveLen > 0.2) { const s = Math.max(hs, RUN); v.x = lerp(v.x, this.moveX * s, 0.6); v.z = lerp(v.z, this.moveZ * s, 0.6); }
      this.events.push({ type: 'airjump' });
    }
    this.coyote -= h;
    this.airTime += h;
    this.pos.addScaledVector(v, h);
    const vyBefore = v.y, preX = v.x, preZ = v.z;
    this._collide();
    this._collideTrees();
    if (this._touchGround && v.y <= 0.5) {
      this._land(vyBefore);
      return;
    }
    if (this._touchWall && this.climbLock <= 0) {
      const into = -(this.moveX * this.wallN.x + this.moveZ * this.wallN.z);
      const vInto = -(preX * this.wallN.x + preZ * this.wallN.z);
      if ((into > 0.3 || vInto > 6) && this._probeWall(this.wallN)) this._enterClimb();
    }
  }

  _land(vy) {
    this.mode = 'ground';
    this.grounded = true;
    this.coyote = 0.12;
    this.airJumps = 1;
    const impact = clamp(-vy / 30, 0, 1);
    if (impact > 0.12) {
      this.girl.land(impact);
      this.shake = Math.max(this.shake, impact * 0.5);
      this.events.push({ type: 'land', k: impact });
    }
    this.airTime = 0;
    // keep some momentum, bleed the rest
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > SPRINT * 1.3) { const k = (SPRINT * 1.3) / hs; this.vel.x *= k; this.vel.z *= k; }
    this.vel.y = 0;
  }

  // ------------------------------------------------------------------ climbing
  /** is there a climbable wall (roughly vertical) in front of the chest? updates this.wallN */
  _probeWall(n, reach = 0.75) {
    _v1.set(this.pos.x, this.pos.y + CHEST, this.pos.z);
    _v2.copy(n).multiplyScalar(-1);
    const hit = this.raycast(_v1, _v2, R + reach);
    if (!hit) return null;
    const hn = this._hitNormal(hit, _v2, _v3);
    if (Math.abs(hn.y) > 0.4) return null;
    this.wallN.set(hn.x, 0, hn.z).normalize();
    return hit;
  }

  _enterClimb() {
    this.mode = 'climb';
    this.vel.set(0, 0, 0);
    this.rope.active = false;
    this.zip.active = false;
    this.airJumps = 1;
    this.grounded = false;
    this.events.push({ type: 'grab' });
  }

  _stepClimb(h, input) {
    const n = this.wallN;
    const v = this.vel;
    // character faces -n; her right hand side along the wall
    const rx = n.z, rz = -n.x;
    const speed = input.sprint ? CLIMB_FAST : CLIMB;
    // strafe keys move along the wall, in whichever sense matches the camera's idea of "right"
    const camR = Math.cos(this.camYaw) * rx - Math.sin(this.camYaw) * rz;
    const side = clamp(input.mx * (camR >= -0.2 ? 1 : -1), -1, 1);
    const upIn = input.my;
    v.set(rx * side * speed, upIn * speed, rz * side * speed);
    this.climbX = side; this.climbY = upIn;

    if (input.dropPressed) { this.mode = 'air'; this.climbLock = 0.5; v.copy(n).multiplyScalar(2.5); return; }
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      this.climbLock = 0.28;
      if (upIn > 0.3 && Math.abs(side) < 0.5) v.set(n.x * 1.2, 12.5, n.z * 1.2);          // leap straight up the wall
      else if (Math.abs(side) > 0.5) v.set(rx * side * 9 + n.x * 3, 7.5, rz * side * 9 + n.z * 3);
      else v.set(n.x * 8.5, 8.2, n.z * 8.5);                                              // kick away
      this.mode = 'air';
      this.airJumps = 1;
      this.events.push({ type: 'jump' });
      return;
    }
    this.pos.addScaledVector(v, h);
    this._collide();

    // stay glued to the surface
    let hit = this._probeWall(n, 0.9);
    if (hit) {
      const want = R + 0.03;
      const d = hit.distance;
      this.pos.x += -n.x * (d - want);
      this.pos.z += -n.z * (d - want);
    } else {
      // lost the wall at chest height
      _v1.set(this.pos.x, this.pos.y + 0.25, this.pos.z);
      _v2.copy(n).multiplyScalar(-1);
      const low = this.raycast(_v1, _v2, R + 0.9);
      if (upIn > 0.1 && low) {
        // top edge: mantle onto the roof / deck
        v.set(-n.x * 3.4, 7.4, -n.z * 3.4);
        this.mode = 'air';
        this.climbLock = 0.45;
        this.events.push({ type: 'vault' });
        return;
      }
      if (Math.abs(side) > 0.1) {
        // outside corner: look for the adjoining face
        const s = Math.sign(side);
        _v1.set(this.pos.x + rx * s * 0.55 - n.x * (R + 0.5), this.pos.y + CHEST, this.pos.z + rz * s * 0.55 - n.z * (R + 0.5));
        _v2.set(-rx * s, 0, -rz * s);
        const c = this.raycast(_v1, _v2, 1.4);
        if (c) {
          const cn = this._hitNormal(c, _v2, _v3);
          if (Math.abs(cn.y) < 0.4) {
            n.set(cn.x, 0, cn.z).normalize();
            this.pos.set(c.point.x + n.x * (R + 0.03), this.pos.y, c.point.z + n.z * (R + 0.03));
            return;
          }
        }
      }
      this.mode = 'air';
      this.climbLock = 0.25;
      return;
    }
    // inside corner: a second wall in the direction of travel
    if (Math.abs(side) > 0.1) {
      const s = Math.sign(side);
      _v1.set(this.pos.x, this.pos.y + CHEST, this.pos.z);
      _v2.set(rx * s, 0, rz * s);
      const c = this.raycast(_v1, _v2, R + 0.25);
      if (c) {
        const cn = this._hitNormal(c, _v2, _v3);
        if (Math.abs(cn.y) < 0.4) n.set(cn.x, 0, cn.z).normalize();
      }
    }
    // reached the ground while climbing down
    if (upIn < -0.1) {
      _v1.set(this.pos.x, this.pos.y + 0.3, this.pos.z);
      const g = this.raycast(_v1, DOWN, 0.42);
      if (g && Math.abs(g.face.normal.y) > 0.6) { this.mode = 'ground'; this.grounded = true; this.vel.set(0, 0, 0); }
    }
  }

  // ------------------------------------------------------------------ swinging
  _stepSwing(h, input) {
    const v = this.vel, r = this.rope;
    v.y -= GRAV * h;
    // steer / pump along the input direction
    if (this.moveLen > 0.01) { v.x += this.moveX * 11 * h; v.z += this.moveZ * 11 * h; }
    // a helping hand: gather speed on the way down, like every good swinging game
    const sp = v.length();
    if (sp > 1 && sp < 36 && v.y < 2) {
      const k = (7.5 * h) / sp;
      v.x += v.x * k; v.z += v.z * k;
    }
    v.multiplyScalar(1 - 0.03 * h);
    if (sp > 38) v.multiplyScalar(1 - 0.5 * h * (sp - 38) / 10);
    // reel in: on request, or automatically so the arc clears the ground
    let want = r.len;
    const clear = r.anchor.y - (this._floorY() + 2.2);
    if (r.len > clear) want = Math.max(ROPE_MIN, clear);
    if (input.sprint) want = Math.max(ROPE_MIN, Math.min(want, r.len - 11 * h));
    if (want < r.len) r.len = Math.max(want, r.len - 16 * h);
    if (input.walk) r.len = Math.min(ROPE_MAX, r.len + 9 * h);

    this.pos.addScaledVector(v, h);
    // rope constraint (inextensible, can go slack)
    _v1.set(this.pos.x - r.anchor.x, this.pos.y + CHEST - r.anchor.y, this.pos.z - r.anchor.z);
    const d = _v1.length();
    this.taut = false;
    if (d > r.len && d > 1e-3) {
      _v1.multiplyScalar(1 / d);
      const corr = d - r.len;
      this.pos.addScaledVector(_v1, -corr);
      const vr = v.dot(_v1);
      if (vr > 0) v.addScaledVector(_v1, -vr);
      this.taut = true;
    }
    const preX = v.x, preZ = v.z, preY = v.y;
    this._collide();
    this._collideTrees();
    if (this._touchGround && v.y <= 0.5) {
      // touched down: keep running, drop the line
      r.active = false;
      this._land(preY);
      return;
    }
    if (this._touchWall && this.climbLock <= 0) {
      const vInto = -(preX * this.wallN.x + preZ * this.wallN.z);
      const push = -(this.moveX * this.wallN.x + this.moveZ * this.wallN.z);
      if ((vInto > 9 || (vInto > 3 && push > 0.5)) && this._probeWall(this.wallN)) { this.shake = Math.max(this.shake, 0.25); this._enterClimb(); return; }
    }
    if (this.jumpBuf > 0) { this.jumpBuf = 0; this.releaseSwing(true); }
  }

  _floorY() {
    _v1.set(this.pos.x, this.pos.y + 1, this.pos.z);
    const hit = this.raycast(_v1, DOWN, 400);
    return hit ? hit.point.y : 0;
  }

  // ------------------------------------------------------------------ zip line
  _stepZip(h) {
    const z = this.zip, v = this.vel;
    z.t += h;
    _v1.subVectors(z.target, this.pos);
    const d = _v1.length();
    if (d < 1.1 || z.t > 5) return this._endZip(true);
    _v1.multiplyScalar(1 / d);
    const sp = Math.min(ZIP_SPEED, 16 + z.t * 110);
    v.copy(_v1).multiplyScalar(sp);
    const step = Math.min(d, sp * h);
    this.pos.addScaledVector(_v1, step);
    if (d - step < 1.1) return this._endZip(true);
    if (z.t > 0.12) {
      // skim over ground and roofs; only a wall squarely in the way ends the flight early
      if (this._collide() && this._touchWall && d > 3.5) {
        const block = -(this.wallN.x * _v1.x + this.wallN.z * _v1.z);
        if (block > 0.5) {
          if (this._probeWall(this.wallN)) { this.rope.active = false; z.active = false; z.cool = 0.25; return this._enterClimb(); }
          return this._endZip(false);
        }
      }
    }
  }

  _endZip(arrived) {
    const z = this.zip;
    z.active = false;
    z.cool = 0.3;
    this.rope.active = false;
    this.airJumps = 1;
    if (arrived && z.wall) {
      this.wallN.set(z.normal.x, 0, z.normal.z).normalize();
      this.pos.copy(z.target);
      if (this._probeWall(this.wallN, 1.2)) { this._enterClimb(); return; }
    }
    this.mode = 'air';
    if (arrived && !z.wall) { this.vel.multiplyScalar(0.14); this.vel.y = 6.2; }     // pop up and land on the spot
    else this.vel.multiplyScalar(0.45);
    this.climbLock = 0.1;
  }

  // ------------------------------------------------------------------ visuals
  _updateVisual(dt, input) {
    const v = this.vel;
    const hs = Math.hypot(v.x, v.z);
    let yawT = this.yaw;
    if (this.mode === 'climb') yawT = Math.atan2(-this.wallN.x, -this.wallN.z);
    else if (this.mode === 'ground') { if (this.moveLen > 0.05) yawT = Math.atan2(this.moveX, this.moveZ); }
    else if (hs > 1.5) yawT = Math.atan2(v.x, v.z);
    this.yaw = dampAngle(this.yaw, yawT, this.mode === 'climb' ? 16 : 11, dt);

    // tilt the body along the rope / line of flight
    const r = this.rope;
    const tilt = _v1.set(0, 1, 0);
    const ropeLocal = this._ropeLocal || (this._ropeLocal = new THREE.Vector3());
    let swingPhase = 0;
    if (this.mode === 'swing' && r.active) {
      _v2.set(r.anchor.x - this.pos.x, r.anchor.y - (this.pos.y + CHEST), r.anchor.z - this.pos.z).normalize();
      tilt.lerp(_v2, this.taut ? 0.72 : 0.35).normalize();
      // forward (+) or backward (-) of the anchor, along the direction of travel
      if (hs > 0.5) swingPhase = clamp(-(_v2.x * v.x + _v2.z * v.z) / hs * 1.6, -1, 1);
    } else if (this.mode === 'zip') {
      _v2.copy(v).normalize();
      tilt.lerp(_v2, 0.62).normalize();
    } else if (this.mode === 'air' && hs > 8 && v.y < -6) {
      _v2.set(v.x, 0, v.z).normalize();
      tilt.addScaledVector(_v2, 0.3).normalize();
    } else if (this.mode === 'ground' && hs > 2) {
      // lean into turns
      const turn = clamp(Math.sin(yawT - this.yaw) * hs * 0.035, -0.3, 0.3);
      tilt.x += Math.cos(this.yaw) * turn; tilt.z -= Math.sin(this.yaw) * turn;
      tilt.normalize();
    }
    _q1.setFromAxisAngle(UP, this.yaw);
    _q2.setFromUnitVectors(UP, tilt);
    _q2.multiply(_q1);
    this.rigQuat.slerp(_q2, 1 - Math.exp(-10 * dt));
    this.rig.quaternion.copy(this.rigQuat);
    this.rig.position.set(this.pos.x, this.pos.y + CHEST, this.pos.z);

    // animation state
    const st = this._st || (this._st = {});
    st.mode = this.mode;
    st.speed = this.speed;
    st.vy = v.y;
    st.run = this.mode === 'ground' ? smoothstep(WALK * 0.9, SPRINT * 0.95, hs) : 0;
    if (this.mode === 'ground') st.speed = hs;
    const fy = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    st.localVz = v.x * fy + v.z * fz;
    st.localVx = v.x * fz - v.z * fy;
    st.climbX = this.climbX || 0; st.climbY = this.climbY || 0;
    st.swingPhase = swingPhase;
    st.joy = this.speed > 24 || (this.mode === 'swing' && this.speed > 17);
    st.ropeDir = null;
    if ((this.mode === 'swing' || this.mode === 'zip') && r.active) {
      // rope direction in the character's local frame
      _v2.set(r.anchor.x - this.pos.x, r.anchor.y - (this.pos.y + CHEST + 0.3), r.anchor.z - this.pos.z).normalize();
      _q1.copy(this.rigQuat).invert();
      ropeLocal.copy(_v2).applyQuaternion(_q1);
      st.ropeDir = ropeLocal;
    }
    this.girl.update(dt, st);
    this.rig.updateMatrixWorld(true);
  }

  _updateRope(dt) {
    const r = this.rope;
    const m = this.ropeMesh;
    if (r.active) { r.t += dt; r.fade = 1; } else r.fade = Math.max(0, r.fade - dt * 7);
    if (r.fade <= 0) { m.visible = false; this.knot.visible = false; return; }
    this.girl.handWorld(r.hand);
    // the line shoots out over ~80 ms, then stays attached
    const k = r.active ? clamp(r.t / 0.085, 0, 1) : 1;
    r.tip.lerpVectors(r.hand, r.anchor, k);
    _v1.subVectors(r.tip, r.hand);
    const len = _v1.length();
    if (len < 0.01) { m.visible = false; return; }
    m.visible = true;
    m.position.copy(r.hand);
    m.quaternion.setFromUnitVectors(UP, _v1.multiplyScalar(1 / len));
    const w = 0.018 * (0.5 + 0.5 * r.fade);
    m.scale.set(w, len, w);
    m.material.opacity = r.fade;
    this.knot.visible = k >= 1;
    this.knot.position.copy(r.anchor);
    this.knot.scale.setScalar(r.fade * (1 + 0.6 * Math.max(0, 1 - r.t * 5)));
  }

  // ------------------------------------------------------------------ camera
  _updateCamera(dt, input) {
    this.camYaw -= input.lookX;
    this.camPitch = clamp(this.camPitch - input.lookY, -1.35, 1.25);
    this._placeCamera(dt, false);
  }

  _placeCamera(dt, snap) {
    const cam = this.camera;
    const sp = this.speed || 0;
    const fast = smoothstep(9, 34, sp);
    const distT = lerp(4.4, 7.6, fast) + (this.mode === 'climb' ? 0.8 : 0);
    this.camDist = snap ? distT : damp(this.camDist, distT, 3, dt);
    // look target leads the motion a little
    _v1.set(this.pos.x, this.pos.y + 1.35 + 0.25 * fast, this.pos.z);
    _v1.x += clamp(this.vel.x * 0.05, -1.6, 1.6); _v1.z += clamp(this.vel.z * 0.05, -1.6, 1.6);
    _v1.y += clamp(this.vel.y * 0.03, -1.2, 1.0);
    if (snap) this.camTarget.copy(_v1);
    else {
      const k = 1 - Math.exp(-14 * dt);
      this.camTarget.x += (_v1.x - this.camTarget.x) * k;
      this.camTarget.z += (_v1.z - this.camTarget.z) * k;
      this.camTarget.y += (_v1.y - this.camTarget.y) * (1 - Math.exp(-18 * dt));
    }
    const cp = Math.cos(this.camPitch), spt = Math.sin(this.camPitch);
    const dir = _v2.set(Math.sin(this.camYaw) * cp, -spt, Math.cos(this.camYaw) * cp);     // from target to camera
    // shoulder offset so the heroine does not hide the crosshair
    const sh = 0.55;
    _v3.set(Math.cos(this.camYaw) * sh, 0, -Math.sin(this.camYaw) * sh);
    const origin = _v1.copy(this.camTarget).add(_v3);
    let dist = this.camDist;
    const hit = this.raycast(origin, dir, dist + 0.4);
    if (hit) dist = Math.max(0.6, hit.distance - 0.35);
    this._camHitDist = snap ? dist : (dist < (this._camHitDist || dist) ? dist : damp(this._camHitDist || dist, dist, 6, dt));
    dist = this._camHitDist;
    cam.position.copy(origin).addScaledVector(dir, dist);
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.5;
      this.shake = damp(this.shake, 0, 9, dt);
    }
    _look.copy(origin).addScaledVector(dir, -20);
    cam.up.set(0, 1, 0);
    cam.lookAt(_look);
    // bank with lateral speed while swinging
    const rgtX = Math.cos(this.camYaw), rgtZ = -Math.sin(this.camYaw);
    const lat = this.vel.x * rgtX + this.vel.z * rgtZ;
    const rollT = this.mode === 'swing' ? clamp(-lat * 0.006, -0.16, 0.16) : 0;
    this.camRoll = damp(this.camRoll, rollT, 4, dt);
    cam.rotateZ(this.camRoll);
    const fovT = lerp(58, 82, fast);
    this.fov = snap ? fovT : damp(this.fov, fovT, 4, dt);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); this.fovChanged = true; }
    cam.updateMatrixWorld();
  }
}

const DOWN = new THREE.Vector3(0, -1, 0);
const EL = [0.85, 0.6, 1.1, 0.38, 1.32];
const AZ = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.55, -1.55];
