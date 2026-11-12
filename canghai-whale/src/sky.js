import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { G } from './materials.js';
import { clamp, lerp, smoothstep, mulberry32 } from './util.js';

const DEG = Math.PI / 180;
const LAT = 22.53 * DEG;       // Shenzhen
const DECL = 12 * DEG;         // a warm day in late April

/** Sun, sky, clouds, stars, image-based lighting and cascaded shadows — all driven by the time of day. */
export class Environment {
  constructor(renderer, scene, camera, q) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.hour = 9.5;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3(0.3, 0.8, 0.4);
    this.night = 0;
    this.day = 1;
    this.sunColor = new THREE.Color();
    this.fogColor = new THREE.Color();
    this._envDirty = true;
    this._envTimer = 0;
    this._lastEnvHour = -99;

    // ---- sky dome (atmospheric scattering + procedural clouds), kept centred on the camera
    this.sky = new Sky();
    this.sky.scale.setScalar(2000);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.sky.material.depthTest = false;
    const u = this.sky.material.uniforms;
    u.turbidity.value = 5.5;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.0085;
    u.mieDirectionalG.value = 0.82;
    u.cloudCoverage.value = 0.42;
    u.cloudDensity.value = 0.55;
    u.cloudElevation.value = 0.45;
    u.cloudScale.value = 0.00016;
    // bring the sky into the same radiometric range as the rest of the scene and keep the sun disc finite
    u.skyScale = { value: SKY_SCALE };
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace('uniform float showSunDisc;', 'uniform float showSunDisc;\nuniform float skyScale;')
      .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( min( texColor * skyScale, vec3( 48.0 ) ), 1.0 );');
    scene.add(this.sky);

    // ---- stars and moon for the night
    const rnd = mulberry32(4242);
    const n = 1600;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, y = Math.pow(rnd(), 0.8) * 0.98 + 0.02, r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * r * 1500; pos[i * 3 + 1] = y * 1500; pos[i * 3 + 2] = Math.sin(a) * r * 1500;
      const b = 0.35 + Math.pow(rnd(), 3) * 1.6, t = rnd();
      col[i * 3] = b * (0.8 + 0.2 * t); col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * (1 - 0.25 * t);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false,
    }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    scene.add(this.stars);
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(26, 32), new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 2.5, 2.8), transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false,
    }));
    this.moon.renderOrder = -8;
    this.moon.frustumCulled = false;
    scene.add(this.moon);

    // ---- distant hills around the bay (Tanglang / Nanshan / the New Territories), drawn as haze silhouettes
    this.hills = this._makeHills();
    scene.add(this.hills);

    // ---- cascaded shadow maps: one directional light per cascade
    this.csm = new CSM({
      camera, parent: scene, cascades: q.cascades, maxFar: q.shadowFar, mode: 'practical',
      shadowMapSize: q.shadowMap, lightDirection: new THREE.Vector3(-0.3, -0.8, -0.4).normalize(),
      lightIntensity: 5, lightNear: 1, lightFar: 2600, lightMargin: 420,
    });
    this.csm.fade = true;
    this.csm.lights.forEach((l, i) => {
      l.shadow.bias = -0.00012 * (i + 1);
      l.shadow.normalBias = 0.035 + 0.07 * i;
    });

    // ---- ambient helpers
    this.hemi = new THREE.HemisphereLight(0x8fb4ff, 0x3a3a30, 0.0);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xbfd4e6, 0.00055);

    // ---- image based lighting baked from the sky
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(60);
    this.envSky.material.uniforms = THREE.UniformsUtils.clone(u);
    this.envSky.material.fragmentShader = this.sky.material.fragmentShader;
    this.envScene.add(this.envSky);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    this.envGround.rotation.x = -Math.PI / 2;
    this.envGround.position.y = -0.6;
    this.envScene.add(this.envGround);
    this.envRT = null;

    this.setTime(this.hour, true);
  }

  _makeHills() {
    const rnd = mulberry32(31337);
    const seg = 180;
    const pos = [];
    const R = 7000;
    const hgt = (a) => {
      let h = 0;
      for (let o = 1; o <= 5; o++) h += Math.sin(a * (1.7 * o + 0.3) + o * o * 1.3) / o;
      // taller towards the north (Tanglang shan) and south-west (Nanshan), low across the bay
      const north = Math.max(0, -Math.sin(a)), sw = Math.max(0, Math.cos(a + 2.2));
      return Math.max(30, (180 + 260 * north + 320 * sw * sw) * (0.65 + 0.3 * h));
    };
    void rnd;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
      const h0 = hgt(a0), h1 = hgt(a1);
      pos.push(x0, -20, z0, x1, -20, z1, x1, h1, z1, x0, -20, z0, x1, h1, z1, x0, h0, z0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x8899aa, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    m.frustumCulled = false;
    m.renderOrder = -7;
    return m;
  }

  /** hour: 0..24 local solar time */
  setTime(hour, force = false) {
    this.hour = ((hour % 24) + 24) % 24;
    const H = (this.hour - 12) * 15 * DEG;
    const sinEl = Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(H);
    const el = Math.asin(clamp(sinEl, -1, 1));
    const cosEl = Math.cos(el);
    let az = Math.acos(clamp((Math.sin(DECL) - sinEl * Math.sin(LAT)) / (Math.max(1e-4, cosEl) * Math.cos(LAT)), -1, 1));
    if (H > 0) az = Math.PI * 2 - az;
    this.sunDir.set(Math.sin(az) * cosEl, sinEl, -Math.cos(az) * cosEl).normalize();
    this.elevation = el / DEG;
    const elD = this.elevation;

    this.day = smoothstep(-5, 7, elD);
    this.night = 1 - smoothstep(-7, 5, elD);
    G.uNight.value = this.night;

    // moon: roughly opposite the sun, always comfortably above the horizon at night
    this.moonDir.set(-this.sunDir.x * 0.8 + 0.25, 0.62, -this.sunDir.z * 0.8 - 0.2).normalize();

    // key light: the sun by day, the moon by night
    const sunI = 9.5 * Math.pow(smoothstep(-1.5, 16, elD), 0.75);
    const low = smoothstep(0, 24, elD);
    this.sunColor.setRGB(1.0, lerp(0.5, 0.94, low), lerp(0.22, 0.84, low));
    const moonI = 0.42 * this.night;
    const useSun = sunI >= moonI;
    this.lightDir.copy(useSun ? this.sunDir : this.moonDir);
    const I = useSun ? sunI : moonI;
    const c = useSun ? this.sunColor : MOON_COLOR;
    this.csm.lightDirection.copy(this.lightDir).multiplyScalar(-1);
    for (const l of this.csm.lights) { l.intensity = I; l.color.copy(c); }
    G.uSunDir.value.copy(this.lightDir);
    this.keyIntensity = I;

    // sky
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir);
    u.rayleigh.value = lerp(2.5, 1.15, low);
    u.turbidity.value = lerp(9, 7.2, low);

    // fog / haze follows the horizon colour
    const dayFog = FOG_DAY, dusk = FOG_DUSK, nightFog = FOG_NIGHT;
    this.fogColor.copy(dusk).lerp(dayFog, smoothstep(1, 20, elD));
    this.fogColor.lerp(nightFog, 1 - this.day);
    this.scene.fog.color.copy(this.fogColor);
    this.hills.material.color.copy(this.fogColor).multiplyScalar(lerp(0.78, 0.9, this.day)).lerp(HILL_TINT, 0.12 * this.day);

    // night ambience: light pollution fill
    this.hemi.intensity = 0.55 * this.night;
    this.exposure = lerp(1.1, 0.62, this.day) * lerp(1.15, 1.0, low);

    this.stars.material.opacity = smoothstep(0.55, 1.0, this.night) * 0.9;
    this.moon.material.opacity = smoothstep(0.3, 0.9, this.night);

    if (force || Math.abs(this.hour - this._lastEnvHour) > 0.02) this._envDirty = true;
  }

  _updateEnv() {
    const u = this.sky.material.uniforms, e = this.envSky.material.uniforms;
    for (const k in e) {
      const v = u[k].value;
      if (v && v.isVector3) e[k].value.copy(v); else e[k].value = v;
    }
    e.showSunDisc.value = 0;
    const g = lerp(0.03, 0.55, this.day) * (0.45 + 0.55 * smoothstep(0, 30, this.elevation));
    this.envGround.material.color.setRGB(g * 1.0, g * 1.02, g * 0.9);
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = lerp(1.0, 1.45, this.day);
    this._lastEnvHour = this.hour;
    this._envDirty = false;
  }

  update(dt, time) {
    const cam = this.camera;
    this.sky.position.copy(cam.position);
    this.sky.material.uniforms.time.value = time;
    this.stars.position.copy(cam.position);
    this.hills.position.set(cam.position.x * 0.9, 0, cam.position.z * 0.9);
    this.moon.position.copy(cam.position).addScaledVector(this.moonDir, 1400);
    this.moon.lookAt(cam.position);
    this._envTimer -= dt;
    if (this._envDirty && this._envTimer <= 0) {
      this._updateEnv();
      this._envTimer = 0.25;
    }
    this.renderer.toneMappingExposure = this.exposure;
    this.csm.update();
  }
}

const SKY_SCALE = 0.135;
const MOON_COLOR = new THREE.Color(0.55, 0.68, 1.0);
const FOG_DAY = new THREE.Color(0.78, 0.86, 0.96);
const FOG_DUSK = new THREE.Color(0.86, 0.52, 0.34);
const FOG_NIGHT = new THREE.Color(0.035, 0.04, 0.065);
const HILL_TINT = new THREE.Color(0.2, 0.32, 0.3);
