import * as THREE from 'three';
import { makeCanvas } from './util.js';

/** A small pooled particle system for dust, spray and sparkles. */
export class Particles {
  constructor(scene, max = 600) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.span = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.base = new Float32Array(max * 4);       // r, g, b, size
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    const c = makeCanvas(64, 64);
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(32, 32, 1, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd;
    x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale / max(0.1, -mv.z); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; varying vec3 vC;
        void main(){ float a = texture2D(map, gl_PointCoord).a; if (a < 0.01) discard; gl_FragColor = vec4(vC * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  /** o: {n, speed, up, spread, life, size, color:[r,g,b], gravity, dir:[x,y,z]} */
  burst(p, o) {
    for (let i = 0; i < o.n; i++) {
      const k = this.head;
      this.head = (this.head + 1) % this.max;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      const sp = o.speed * (0.4 + 0.6 * Math.random());
      let vx = Math.cos(a) * r * sp, vz = Math.sin(a) * r * sp, vy = (o.up || 0) * (0.5 + 0.5 * Math.random());
      if (o.dir) { vx = vx * 0.5 + o.dir[0] * sp; vy += o.dir[1] * sp; vz = vz * 0.5 + o.dir[2] * sp; }
      const s = o.spread || 0.2;
      this.pos[k * 3] = p.x + (Math.random() - 0.5) * s; this.pos[k * 3 + 1] = p.y + (Math.random() - 0.5) * s * 0.5; this.pos[k * 3 + 2] = p.z + (Math.random() - 0.5) * s;
      this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
      this.span[k] = this.life[k] = o.life * (0.6 + 0.4 * Math.random());
      this.grav[k] = o.gravity === undefined ? 9 : o.gravity;
      const v = 0.8 + 0.4 * Math.random();
      this.base[k * 4] = o.color[0] * v; this.base[k * 4 + 1] = o.color[1] * v; this.base[k * 4 + 2] = o.color[2] * v;
      this.base[k * 4 + 3] = o.size * (0.6 + 0.8 * Math.random());
    }
  }

  update(dt, height) {
    this.points.material.uniforms.uScale.value = height * 0.9;
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { if (this.size[k] !== 0) this.size[k] = 0; continue; }
      this.life[k] -= dt;
      const t = Math.max(0, this.life[k] / this.span[k]);
      this.vel[k * 3 + 1] -= this.grav[k] * dt;
      const drag = 1 - 1.6 * dt;
      this.vel[k * 3] *= drag; this.vel[k * 3 + 2] *= drag;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      const f = Math.min(1, t * 2.2);
      this.col[k * 3] = this.base[k * 4] * f; this.col[k * 3 + 1] = this.base[k * 4 + 1] * f; this.col[k * 3 + 2] = this.base[k * 4 + 2] * f;
      this.size[k] = this.base[k * 4 + 3] * (0.6 + 0.8 * (1 - t));
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
  }
}
