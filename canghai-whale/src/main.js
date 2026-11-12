import * as THREE from 'three';
import { initMaterials, G, std } from './materials.js';
import { Environment } from './sky.js';
import { Pipeline } from './post.js';
import { buildWorld, DATA } from './world.js';
import { buildVegetation } from './vegetation.js';
import { buildProps } from './props.js';
import { WhaleGirl } from './character.js';
import { Player } from './player.js';
import { Sound } from './audio.js';
import { Particles } from './fx.js';
import { pointInRing, clamp, lerp } from './util.js';

// ---------------------------------------------------------------------------------------------- settings
const params = new URLSearchParams(location.search);
const PRESETS = {
  low: { name: '流畅', treeLod0: 60, treeLod1: 220, cascades: 2, shadowMap: 1024, shadowFar: 240, msaa: 0, ao: false, aoSamples: 8, bloom: true, pixelRatio: 0.85, treeFraction: 0.45, treeShadows: false, traffic: 0.5 },
  medium: { name: '均衡', treeLod0: 110, treeLod1: 330, cascades: 3, shadowMap: 2048, shadowFar: 380, msaa: 2, ao: false, aoSamples: 8, bloom: true, pixelRatio: 1.0, treeFraction: 0.75, treeShadows: true, traffic: 1 },
  high: { name: '高', treeLod0: 140, treeLod1: 420, cascades: 4, shadowMap: 2048, shadowFar: 520, msaa: 4, ao: true, aoSamples: 10, bloom: true, pixelRatio: 1.25, treeFraction: 1, treeShadows: true, traffic: 1 },
  ultra: { name: '极致', treeLod0: 260, treeLod1: 650, cascades: 4, shadowMap: 4096, shadowFar: 620, msaa: 4, ao: true, aoSamples: 16, bloom: true, pixelRatio: 2, treeFraction: 1, treeShadows: true, traffic: 1.3 },
  test: { name: 'test', treeLod0: 170, treeLod1: 460, cascades: 3, shadowMap: 1024, shadowFar: 380, msaa: 0, ao: true, aoSamples: 8, bloom: true, pixelRatio: 1, treeFraction: 0.5, treeShadows: true, traffic: 1 },
};
const store = {
  get(k, d) { try { const v = localStorage.getItem('cw.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cw.' + k, v); } catch (e) { /* private mode */ } },
};
/** first run: pick a preset from the GPU name; the player can change it any time in the pause menu */
function guessQuality() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    if (/SwiftShader|llvmpipe|Software|Mali|Adreno|PowerVR/i.test(name)) return 'low';
    if (/Intel|UHD|Iris|HD Graphics/i.test(name) && !/Arc/i.test(name)) return 'low';
    if (/Apple|Radeon\(TM\) Graphics|Vega|GTX 9|GTX 10[0-5]|MX[0-9]/i.test(name)) return 'medium';
    return 'high';
  } catch (e) { return 'medium'; }
}
let qName = params.get('q') || store.get('quality', '') || guessQuality();
if (!PRESETS[qName]) qName = 'high';
const Q = Object.assign({}, PRESETS[qName]);
for (const k of ['ao', 'bloom', 'msaa', 'cascades', 'treeFraction', 'shadowMap', 'pixelRatio']) if (params.has(k)) Q[k] = Number(params.get(k));
const AUTO = params.has('auto');
const freezeAt = Number(params.get('freeze') || 0);

const $ = (id) => document.getElementById(id);
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
let dynScale = 1;
const basePR = () => Math.min(window.devicePixelRatio || 1, Q.pixelRatio);
renderer.setPixelRatio(basePR());
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 12000);
camera.position.set(-260, 150, -260);
camera.lookAt(40, 10, 20);

let env, world, veg, props, girl, player, pipe, tokens, minimap, fx;
const sound = new Sound();
sound.setMuted(store.get('mute', '0') === '1');
let state = 'loading';       // loading | ready | playing | paused
let time = 0, frames = 0;
let hour = params.has('t') ? parseFloat(params.get('t')) : 15.6;
let cycle = false;
let sens = parseFloat(store.get('sens', '1'));

const input = { mx: 0, my: 0, lookX: 0, lookY: 0, jumpPressed: false, sprint: false, walk: false, swingHeld: false, swingPressed: false, zipPressed: false, dropPressed: false };
const keys = new Set();

// ---------------------------------------------------------------------------------------------- loading
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
function progress(p, msg) {
  $('bar').firstElementChild.style.width = p + '%';
  if (msg) $('loadmsg').textContent = msg;
}

async function boot() {
  progress(6, '正在升起太阳…');
  await tick();
  env = new Environment(renderer, scene, camera, Q);
  initMaterials(env.csm);
  env.setTime(hour, true);

  if (params.get('char')) return bootBench();

  progress(18, '正在根据 OpenStreetMap 铺设沧海校区…');
  await tick();
  world = buildWorld(scene);
  progress(46, '正在种下榕树、荔枝与大王椰…');
  await tick();
  veg = buildVegetation(scene, world.data, Q);
  progress(64, '正在点亮路灯、发车…');
  await tick();
  props = buildProps(scene, world, Q);
  progress(74, '正在唤醒鲸鱼娘…');
  await tick();
  girl = new WhaleGirl();
  player = new Player(world, veg, girl, camera, sound);
  player.addTo(scene);
  fx = new Particles(scene);
  tokens = buildTokens();
  minimap = buildMinimap();
  buildMenus();
  respawn();
  pipe = new Pipeline(renderer, scene, camera, Q);
  env.csm.updateFrustums();
  progress(86, '正在编译着色器…');
  await tick();
  try { renderer.compile(scene, camera); } catch (e) { /* compiled lazily instead */ }
  await tick();
  progress(100, '准备就绪 — 点击开始');
  state = 'ready';
  $('go').disabled = false;
  if (AUTO) startGame();
}

function bootBench() {
  // character test bench (?char=1)
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), std({ color: 0x8a9a8a, roughness: 0.9 }));
  gm.rotation.x = -Math.PI / 2; gm.receiveShadow = true; scene.add(gm);
  girl = new WhaleGirl();
  scene.add(girl.root);
  girl.root.rotation.y = Number(params.get('yaw') || 0);
  const st = { mode: params.get('pose') || 'ground', speed: Number(params.get('speed') || 0), run: Number(params.get('run') || 0), vy: Number(params.get('vy') || 0), localVz: Number(params.get('speed') || 0), climbY: 1, swingPhase: Number(params.get('sp') || 0), ropeDir: new THREE.Vector3(0.2, 0.9, 0.35).normalize(), joy: params.get('joy') === '1' };
  girl.phase = Number(params.get('phase') || 0);
  for (let i = 0; i < 60; i++) { const ph = girl.phase; girl.update(1 / 60, st); if (params.has('phase')) girl.phase = ph; }
  const c = (params.get('cam') || '1.2,1.3,2.6,0,0.9,0').split(',').map(Number);
  camera.position.set(c[0], c[1], c[2]);
  camera.lookAt(c[3], c[4], c[5]);
  if (params.get('fov')) { camera.fov = parseFloat(params.get('fov')); camera.updateProjectionMatrix(); }
  pipe = new Pipeline(renderer, scene, camera, Q);
  env.csm.updateFrustums();
  $('start').classList.add('hidden');
  state = 'bench';
}

// ---------------------------------------------------------------------------------------------- spawn / teleport
function gatePoint() {
  const g = DATA.pois.find((p) => p.k === 'gate' && p.n === '致远门') || { x: -84, z: -50 };
  // a few steps inside the gate, facing the heart of the campus
  const dx = 40 - g.x, dz = 20 - g.z;
  const l = Math.hypot(dx, dz);
  return { x: g.x + (dx / l) * 14, z: g.z + (dz / l) * 14, yaw: Math.atan2(dx, dz) };
}
function respawn() {
  if (params.has('pos')) {
    const p = params.get('pos').split(',').map(Number);
    player.spawn(p[0], p[1], p[2], Number(params.get('yaw') || 0));
  } else {
    const g = gatePoint();
    player.spawn(g.x, 0.6, g.z, g.yaw);
  }
  if (params.has('pitch')) player.camPitch = Number(params.get('pitch'));
  if (params.has('camyaw')) player.camYaw = Number(params.get('camyaw'));
}
function teleport(lm) {
  player.spawn(lm.x, lm.h + 3.5, lm.z, player.yaw);
  resume();
}

// ---------------------------------------------------------------------------------------------- tokens
function buildTokens() {
  const pts = [];
  const best = new Map();
  for (const l of world.landmarks) {
    const cur = best.get(l.name);
    if (!cur || l.h > cur.h) best.set(l.name, l);
  }
  for (const l of best.values()) pts.push([l.x, l.h + 3.2, l.z]);
  for (const d of DATA.decks) {
    const n = d.p.length / 3;
    if (d.k !== 'foot' || n < 14) continue;
    const i = Math.floor(n / 2) * 3;
    pts.push([d.p[i], d.p[i + 1] + 1.5, d.p[i + 2]]);
  }
  for (const p of DATA.pitches) pts.push([p.cx, 1.4, p.cz]);
  // a trail of tokens in mid-air above Baishi Road: made for swinging
  for (const r of DATA.roads) {
    if (r.k !== 'primary' || r.p.length < 8) continue;
    let acc = 30;
    for (let i = 0; i < r.p.length - 2; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], bx = r.p[i + 2], bz = r.p[i + 3];
      const len = Math.hypot(bx - ax, bz - az);
      acc += len;
      if (acc > 95) { acc = 0; pts.push([(ax + bx) / 2, 17 + 7 * Math.sin(i), (az + bz) / 2]); }
    }
  }
  const b = DATA.world;
  const list = pts.filter((p) => p[0] > b[0] + 12 && p[0] < b[2] - 12 && p[2] > b[1] + 12 && p[2] < b[3] - 12)
    .map((p, i) => ({ x: p[0], y: p[1], z: p[2], got: false, ph: i * 1.7 }));
  const geo = new THREE.OctahedronGeometry(0.62, 0);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.25, 2.6), fog: false });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  mesh.frustumCulled = false;
  const shell = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.86, 0), new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.25, 0.6, 1.3), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }), list.length);
  shell.frustumCulled = false;
  scene.add(mesh, shell);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let got = 0;
  const update = (dt, t) => {
    const pp = player.pos;
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (k.got) { if (k.s > 0) k.s = Math.max(0, k.s - dt * 5); } else k.s = 1;
      const bob = Math.sin(t * 2 + k.ph) * 0.25;
      p.set(k.x, k.y + bob, k.z);
      e.set(0, t * 1.6 + k.ph, 0);
      q.setFromEuler(e);
      s.setScalar(k.s);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      s.setScalar(k.s * (1 + 0.12 * Math.sin(t * 3 + k.ph)));
      m4.compose(p, q, s);
      shell.setMatrixAt(i, m4);
      if (!k.got) {
        const dx = pp.x - k.x, dy = pp.y + 0.9 - k.y, dz = pp.z - k.z;
        if (dx * dx + dy * dy + dz * dz < 2.7 * 2.7) {
          k.got = true;
          got++;
          sound.token();
          fx.burst(p, { n: 26, speed: 5, up: 3, life: 0.7, size: 0.5, color: [0.5, 1.1, 2.4], gravity: 2 });
          $('tok').textContent = `${got} / ${list.length}`;
          if (got === list.length) { toast('全部 Token 到手 · 鲸鱼娘吃饱啦！', 5); sound.fanfare(); } else toast(`Token +1　${got} / ${list.length}`, 1.4);
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    shell.instanceMatrix.needsUpdate = true;
  };
  $('tok').textContent = `0 / ${list.length}`;
  return { list, update };
}

// ---------------------------------------------------------------------------------------------- minimap
function buildMinimap() {
  const [x0, z0, x1, z1] = DATA.world;
  const W = x1 - x0, H = z1 - z0;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const g = off.getContext('2d');
  g.fillStyle = '#c4c0b6';
  g.fillRect(0, 0, W, H);
  const path = (p) => {
    g.beginPath();
    const ring = (r) => { for (let i = 0; i < r.length; i += 2) { if (i === 0) g.moveTo(r[i] - x0, r[i + 1] - z0); else g.lineTo(r[i] - x0, r[i + 1] - z0); } g.closePath(); };
    ring(p.o);
    for (const h of p.h) ring(h);
  };
  const fill = (name, color) => { g.fillStyle = color; for (const p of DATA.ground[name] || []) { path(p); g.fill('evenodd'); } };
  fill('lawn', '#a5d28f'); fill('grass', '#93c97f'); fill('wood', '#6fae66'); fill('pave', '#e2dbcc'); fill('plaza', '#e9d6b4');
  fill('road', '#858a92'); fill('water', '#6fb7ea'); fill('pool', '#59d0ee');
  for (const p of DATA.pitches) { g.fillStyle = p.sp === 'soccer' || p.sp === 'futsal' ? '#57a366' : '#4f84b8'; path(p); g.fill('evenodd'); }
  g.lineCap = 'round';
  for (const d of DATA.decks) {
    g.strokeStyle = d.k === 'steps' ? '#b99ad8' : '#d6b8f2';
    g.lineWidth = d.w;
    g.beginPath();
    for (let i = 0; i < d.p.length; i += 3) { if (i === 0) g.moveTo(d.p[i] - x0, d.p[i + 2] - z0); else g.lineTo(d.p[i] - x0, d.p[i + 2] - z0); }
    g.stroke();
  }
  for (const b of DATA.buildings) {
    if (b.part && b.mh > 0) continue;
    g.fillStyle = b.c === 1 ? '#ffffff' : b.c === 2 ? '#efe6d6' : '#aaa49b';
    g.strokeStyle = b.c === 1 ? '#5468b0' : 'rgba(60,60,70,.55)';
    g.lineWidth = b.c === 1 ? 1.6 : 0.8;
    path(b);
    g.fill('evenodd');
    g.stroke();
  }
  g.strokeStyle = 'rgba(77,107,254,.8)';
  g.setLineDash([8, 6]);
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < DATA.canghai.length; i += 2) { if (i === 0) g.moveTo(DATA.canghai[i] - x0, DATA.canghai[i + 1] - z0); else g.lineTo(DATA.canghai[i] - x0, DATA.canghai[i + 1] - z0); }
  g.closePath();
  g.stroke();
  g.setLineDash([]);

  const mc = $('miniC'), ctx = mc.getContext('2d');
  const S = mc.width, C = S / 2, VIEW = 150;
  const draw = () => {
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, C, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1b2440'; ctx.fillRect(0, 0, S, S);
    ctx.translate(C, C);
    ctx.rotate(player.camYaw);
    const k = C / VIEW;
    ctx.scale(k, k);
    ctx.translate(-(player.pos.x - x0), -(player.pos.z - z0));
    ctx.drawImage(off, 0, 0);
    // tokens
    for (const t of tokens.list) {
      if (t.got) continue;
      const dx = t.x - player.pos.x, dz = t.z - player.pos.z;
      if (dx * dx + dz * dz > VIEW * VIEW * 1.1) continue;
      ctx.fillStyle = '#3d7bff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(t.x - x0, t.z - z0, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    // player arrow
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(Math.PI - (player.yaw - player.camYaw));
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2b47c8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(10, 11); ctx.lineTo(0, 5); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // north mark
    const na = player.camYaw;
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', C + Math.sin(na) * (C - 18), C - Math.cos(na) * (C - 18));
  };
  const drawFull = () => {
    const fc = $('mapC');
    const sc = Math.min((window.innerWidth * 0.94) / W, (window.innerHeight * 0.92) / H) * (window.devicePixelRatio || 1);
    fc.width = Math.round(W * sc); fc.height = Math.round(H * sc);
    const c = fc.getContext('2d');
    c.setTransform(sc, 0, 0, sc, 0, 0);
    c.drawImage(off, 0, 0);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const seen = new Set();
    for (const l of world.landmarks) {
      if (l.campus !== 1 || seen.has(l.name)) continue;
      seen.add(l.name);
      c.font = `700 ${13}px sans-serif`;
      c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)'; c.fillStyle = '#1c2c86';
      c.strokeText(l.name, l.x - x0, l.z - z0); c.fillText(l.name, l.x - x0, l.z - z0);
    }
    for (const t of tokens.list) {
      if (t.got) continue;
      c.fillStyle = '#3d7bff'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(t.x - x0, t.z - z0, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.save();
    c.translate(player.pos.x - x0, player.pos.z - z0);
    c.rotate(Math.PI - player.yaw);
    c.fillStyle = '#ff5a5a'; c.strokeStyle = '#fff'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(0, -13); c.lineTo(9, 10); c.lineTo(0, 4); c.lineTo(-9, 10); c.closePath(); c.fill(); c.stroke();
    c.restore();
  };
  return { draw, drawFull };
}

// ---------------------------------------------------------------------------------------------- HUD
const MODE_NAME = { ground: '奔跑', air: '腾空', climb: '攀爬', swing: '摆荡', zip: '飞拉' };
const HINTS = {
  ground: '朝墙面奔跑即可<b>攀爬</b>　<b>左键</b>摆荡　<b>右键</b>飞拉到准星　<b>Shift</b>冲刺',
  air: '按住<b>左键</b>摆荡　<b>空格</b>二段跳　<b>右键</b>飞拉',
  climb: '<b>W A S D</b>攀爬　<b>空格</b>蹬墙跳　<b>Shift</b>快爬　<b>X</b>松手',
  swing: '松开<b>左键</b>脱手　<b>空格</b>弹射　<b>Shift</b>收绳加速',
  zip: '飞拉中…',
};
let toastT = 0, hudT = 0, lastMode = '', hintT = 150, fpsAcc = 0, fpsN = 0, fpsShown = 60;
function toast(msg, sec = 2) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  toastT = sec;
}
function clockName(h) {
  if (h >= 5 && h < 7.5) return '清晨';
  if (h < 11 && h >= 7.5) return '上午';
  if (h < 14 && h >= 11) return '正午';
  if (h < 17.3 && h >= 14) return '午后';
  if (h < 19 && h >= 17.3) return '黄昏';
  return '夜晚';
}
function fmtClock(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function locate() {
  const p = player.pos;
  let best = null, bd = 1e9;
  for (const l of world.landmarks) {
    const d = Math.hypot(l.x - p.x, l.z - p.z) - l.r;
    if (d < 16 && d < bd) { bd = d; best = l; }
  }
  if (best) return [best.name, best.sub || (best.campus === 1 ? '深圳大学 · 沧海校区' : best.campus === 2 ? '深圳大学 · 粤海校区' : '深圳湾 · 高新南')];
  if (pointInRing(p.x, p.z, DATA.canghai)) return ['沧海校区', '深圳大学'];
  if (DATA.yuehai.length && pointInRing(p.x, p.z, DATA.yuehai)) return ['粤海校区', '深圳大学'];
  return ['高新南', '深圳 · 南山区'];
}
const _proj = new THREE.Vector3();
function updateHud(dt) {
  toastT -= dt;
  if (toastT <= 0) $('toast').classList.remove('on');
  hintT -= dt;
  if (player.mode !== lastMode) {
    lastMode = player.mode;
    $('mode').textContent = MODE_NAME[player.mode];
    $('hint').innerHTML = HINTS[player.mode];
  }
  $('hint').style.opacity = hintT > 0 ? 1 : 0;
  // reticle + anchor marker
  const ret = $('ret'), an = $('anchor');
  const pv = player.preview;
  ret.className = pv.zip ? 'zip' : '';
  let shown = false;
  const a = player.rope.active ? null : pv.swing;
  if (a) {
    _proj.copy(a.point).project(camera);
    if (_proj.z < 1 && Math.abs(_proj.x) < 1 && Math.abs(_proj.y) < 1) {
      an.style.left = ((_proj.x * 0.5 + 0.5) * 100).toFixed(2) + '%';
      an.style.top = ((-_proj.y * 0.5 + 0.5) * 100).toFixed(2) + '%';
      shown = true;
    }
  }
  an.style.opacity = shown ? 0.9 : 0;
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.1;
    $('spd').textContent = Math.round(player.speed * 3.6);
    $('alt').textContent = Math.max(0, Math.round(player.pos.y));
    const [n, s] = locate();
    if ($('locName').textContent !== n) $('locName').textContent = n;
    if ($('locSub').textContent !== s) $('locSub').textContent = s;
    $('clock').textContent = fmtClock(hour);
    $('clockName').textContent = clockName(hour);
    minimap.draw();
    $('fps').textContent = `${Math.round(fpsShown)} FPS · ${(basePR() * dynScale).toFixed(2)}x`;
  }
  $('vign').style.opacity = clamp((player.speed - 16) / 30, 0, 1).toFixed(2);
}

// ---------------------------------------------------------------------------------------------- menus
const TIMES = [6.6, 9.5, 12.5, 15.6, 18.05, 21];
function setHour(h, announce) {
  hour = ((h % 24) + 24) % 24;
  env.setTime(hour, true);
  $('tod').value = hour;
  $('todv').textContent = fmtClock(hour);
  if (announce) toast(`${clockName(hour)} ${fmtClock(hour)}`, 1.5);
}
function buildMenus() {
  const qs = $('qsel');
  for (const k of ['low', 'medium', 'high', 'ultra']) {
    const b = document.createElement('button');
    b.textContent = PRESETS[k].name;
    if (k === qName) b.classList.add('on');
    b.onclick = () => { if (k !== qName) { store.set('quality', k); location.reload(); } };
    qs.appendChild(b);
  }
  const tp = $('tp');
  const seen = new Set();
  const list = world.landmarks.filter((l) => l.campus === 1).sort((a, b) => b.h - a.h);
  for (const l of list) {
    if (seen.has(l.name)) continue;
    seen.add(l.name);
    const b = document.createElement('button');
    b.textContent = l.name;
    b.onclick = () => teleport(l);
    tp.appendChild(b);
  }
  $('tod').oninput = (e) => setHour(parseFloat(e.target.value), false);
  $('cycle').onclick = () => { cycle = !cycle; $('cycle').textContent = cycle ? '开启' : '关闭'; $('cycle').classList.toggle('on', cycle); };
  $('snd').onclick = () => { sound.setMuted(!sound.muted); store.set('mute', sound.muted ? '1' : '0'); $('snd').textContent = sound.muted ? '关闭' : '开启'; };
  $('snd').textContent = sound.muted ? '关闭' : '开启';
  $('sens').value = sens;
  $('sens').oninput = (e) => { sens = parseFloat(e.target.value); store.set('sens', String(sens)); };
  $('resume').onclick = resume;
  $('respawn').onclick = () => { respawn(); resume(); };
  setHour(hour, false);
}

function lockPointer() {
  if (AUTO) return;
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not available */ }
}
function startGame() {
  sound.init();
  $('start').classList.add('fade');
  setTimeout(() => $('start').classList.add('hidden'), 700);
  $('hud').classList.add('on');
  state = 'playing';
  respawn();
  lockPointer();
  canvas.focus();
  toast('深圳大学 · 沧海校区', 3);
}
let pausedAt = 0;
function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  pausedAt = performance.now();
  keys.clear();
  input.swingHeld = false;
  $('pause').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
function resume() {
  if (state !== 'paused') return;
  $('pause').classList.add('hidden');
  $('mapfull').classList.add('hidden');
  state = 'playing';
  lockPointer();
  canvas.focus();
}

// ---------------------------------------------------------------------------------------------- input
$('go').onclick = () => { if (state === 'ready') startGame(); };
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (state === 'ready' && (e.code === 'Enter' || e.code === 'Space')) return startGame();
  if (e.code === 'Escape') {
    // some browsers deliver the Esc that released the pointer lock as a key event too: do not un-pause on it
    if (state === 'playing') pause(); else if (state === 'paused' && performance.now() - pausedAt > 450) resume();
    return;
  }
  if (state !== 'playing') return;
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space') input.jumpPressed = true;
  else if (e.code === 'KeyE') input.zipPressed = true;
  else if (e.code === 'KeyQ' || e.code === 'KeyF') { input.swingHeld = true; input.swingPressed = true; }
  else if (e.code === 'KeyX') input.dropPressed = true;
  else if (e.code === 'KeyR') respawn();
  else if (e.code === 'KeyH') hintT = hintT > 0 ? 0 : 600;
  else if (e.code === 'KeyT') { const i = TIMES.findIndex((t) => t > hour + 0.05); setHour(TIMES[i < 0 ? 0 : i], true); }
  else if (e.code === 'KeyM') { const m = $('mapfull'); m.classList.toggle('hidden'); if (!m.classList.contains('hidden')) minimap.drawFull(); }
  else if (e.code === 'KeyP') pause();
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyQ' || e.code === 'KeyF') input.swingHeld = false;
});
window.addEventListener('blur', () => { keys.clear(); input.swingHeld = false; });
canvas.addEventListener('mousedown', (e) => {
  if (state !== 'playing') return;
  sound.init();
  if (!document.pointerLockElement && !AUTO) { lockPointer(); }
  if (e.button === 0) { input.swingHeld = true; input.swingPressed = true; } else if (e.button === 2) input.zipPressed = true;
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) input.swingHeld = false; });
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousemove', (e) => {
  if (state !== 'playing') return;
  if (document.pointerLockElement !== canvas && !(e.buttons & 3) && !AUTO) return;
  const k = 0.0021 * sens;
  input.lookX += clamp(e.movementX || 0, -300, 300) * k;
  input.lookY += clamp(e.movementY || 0, -300, 300) * k;
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing' && !AUTO) pause();
});
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (env) env.csm.updateFrustums();
  if (pipe) pipe.setSize();
});

function gatherInput() {
  const k = (c) => (keys.has(c) ? 1 : 0);
  input.mx = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
  input.my = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
  input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  input.walk = keys.has('KeyC');
}
function clearEdges() {
  input.jumpPressed = input.swingPressed = input.zipPressed = input.dropPressed = false;
  input.lookX = input.lookY = 0;
}

// ---------------------------------------------------------------------------------------------- loop
let last = performance.now(), csmT = 0, dynT = 0, dynAcc = 0, dynN = 0, playFrames = 0;
function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(raw, 1 / 20);
  frames++;
  window.__frames = frames;

  if (state === 'playing') {
    time += dt;
    gatherInput();
    if (window.__input) Object.assign(input, window.__input);       // scripted tests
    player.update(dt, input);
    clearEdges();
    for (const ev of player.events) {
      if (ev.type === 'thwip') { sound.thwip(); fx.burst(player.rope.anchor, { n: 12, speed: 3.5, up: 1, life: 0.4, size: 0.3, color: [1.6, 1.9, 2.2], gravity: 4 }); }
      else if (ev.type === 'release') sound.release();
      else if (ev.type === 'jump') sound.jump();
      else if (ev.type === 'airjump') { sound.airjump(); fx.burst(player.pos, { n: 46, speed: 3.2, up: -2.5, spread: 0.5, life: 0.7, size: 0.34, color: [0.7, 1.3, 1.9], gravity: 12 }); }
      else if (ev.type === 'land') { sound.land(ev.k); if (ev.k > 0.25) fx.burst(player.pos, { n: Math.round(14 + 40 * ev.k), speed: 2 + 5 * ev.k, up: 1.2, spread: 0.6, life: 0.9, size: 0.7, color: [0.5, 0.47, 0.42], gravity: 1.5 }); }
      else if (ev.type === 'step') sound.step(ev.k);
      else if (ev.type === 'grab') sound.grab();
      else if (ev.type === 'vault') sound.vault();
      else if (ev.type === 'noanchor') { sound.noanchor(); $('ret').className = 'bad'; }
      else if (ev.type === 'edge' && toastT <= 0) toast('前方是地图边界', 1.2);
    }
    player.events.length = 0;
    tokens.update(dt, time);
    fx.update(dt, renderer.domElement.height);
    if (cycle) { hour = (hour + (dt * 24) / 900) % 24; env.setTime(hour); }
    sound.update(dt, player.speed, env.night, player.pos.y);
    updateHud(dt);
    csmT -= dt;
    if (player.fovChanged && csmT <= 0) { env.csm.updateFrustums(); player.fovChanged = false; csmT = 0.2; }
  } else if (state === 'loading' || state === 'ready') {
    // slow aerial orbit behind the title
    time += dt;
    const a = time * 0.035 + 2.2;
    camera.position.set(40 + Math.cos(a) * 330, 135 + Math.sin(time * 0.1) * 18, 20 + Math.sin(a) * 330);
    camera.lookAt(40, 18, 20);
  } else if (state === 'paused') {
    time += dt * 0.0;
  } else if (state === 'bench') {
    time += dt;
  }

  renderFrame(dt);

  // dynamic resolution keeps the frame rate up on weaker GPUs
  fpsAcc += raw; fpsN++;
  if (fpsAcc > 0.5) { fpsShown = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (state === 'playing' && !AUTO) {
    dynAcc += raw; dynN++;
    dynT += raw;
    if (dynT > 1.2) {
      const avg = dynAcc / dynN;
      let s = dynScale;
      if (avg > 1 / 40) s = Math.max(0.5, s * 0.88); else if (avg < 1 / 57 && s < 1) s = Math.min(1, s * 1.07);
      if (Math.abs(s - dynScale) > 0.02) {
        dynScale = s;
        renderer.setPixelRatio(basePR() * dynScale);
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        pipe.setSize();
      }
      dynT = 0; dynAcc = 0; dynN = 0;
    }
  }
  if (state === 'playing' || state === 'bench') { playFrames++; window.__playFrames = playFrames; }
  if (freezeAt && playFrames >= freezeAt) { window.__frozen = true; return; }
  requestAnimationFrame(frame);
}

function renderFrame(dt) {
  if (!pipe) return;
  G.uTime.value = time;
  camera.updateMatrixWorld();
  env.update(dt, time);
  if (props) props.update(state === 'paused' ? 0 : dt, time, env.night, player ? player.pos : camera.position);
  if (veg) veg.update(camera.position);
  pipe.bloomThreshold = lerp(1.05, 3.2, env.day);
  if (pipe.bloom) pipe.bloom.strength = lerp(0.55, 0.3, env.day);
  const fx = player && state === 'playing' ? clamp((player.speed - 18) / 34, 0, 1) : 0;
  pipe.render(dt, time, fx);
}

// headless test hook: advance the simulation without rendering
function sim(n, dt, patch) {
  const out = [];
  for (let i = 0; i < n; i++) {
    gatherInput();
    Object.assign(input, patch || {});
    if (i > 0) { input.jumpPressed = input.swingPressed = input.zipPressed = input.dropPressed = false; }
    player.update(dt, input);
    player.events.length = 0;
    clearEdges();
    time += dt;
  }
  const p = player;
  return { mode: p.mode, pos: p.pos.toArray().map((v) => +v.toFixed(2)), vel: p.vel.toArray().map((v) => +v.toFixed(2)), speed: +p.speed.toFixed(2), out };
}
window.__game = {
  sim, renderFrame, updateHud: (dt) => updateHud(dt), pause: () => pause(),
  get scene() { return scene; }, get camera() { return camera; }, get env() { return env; }, get world() { return world; },
  get player() { return player; }, get props() { return props; }, get veg() { return veg; }, get pipe() { return pipe; }, get girl() { return girl; }, renderer, input, setHour,
  get state() { return state; },
};

boot().catch((e) => {
  console.error(e);
  $('loadmsg').textContent = '加载失败：' + (e && e.message ? e.message : e);
});
requestAnimationFrame(frame);
