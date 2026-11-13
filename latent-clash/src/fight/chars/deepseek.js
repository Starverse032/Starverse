/* LATENT CLASH — FIGHT: DeepSeek 娘 (深海探索者). Fast rush-down, short reach, quick.
 * Boxes are [x, y, w, h] relative to the origin (feet), facing right, y negative = up. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};

  function N(btn, stance, s, a, r, hit) {
    var air = stance === 'air';
    var h = { seg: 'active', anchor: 'weapon', lv: btn };
    for (var k in hit) h[k] = hit[k];
    return {
      kind: 'normal', btn: btn, stance: stance,
      anim: (air ? 'j' : stance === 'crouch' ? '2' : '5') + btn,
      segs: [['startup', s], ['active', a], ['recovery', r, air ? { loop: 'land' } : null]],
      hits: [h]
    };
  }

  F.defineChar({
    id: 'deepseek',
    hp: 1000,
    walkF: 1.7, walkB: 1.3,
    jump: { vy: 7.2, g: 0.38, vxF: 3.0, vxB: 2.5 },
    dashF: { d: 72, f: 16 },
    dashB: { d: 56, f: 18, inv: 8 },
    push: { stand: [-11, -42, 22, 42], crouch: [-12, -32, 24, 32], air: [-9, -50, 18, 38] },
    hurt: {
      stand: [[-9, -66, 18, 22], [-13, -46, 26, 46]],
      crouch: [[-14, -42, 28, 42]],
      air: [[-11, -60, 22, 48]]
    },
    throwRange: 42,
    projColor: 'accent',
    anchorFb: {
      head: [2, -58], chest: [2, -42], hip: [0, -28], center: [0, -34], top: [0, -76],
      handF: [14, -40], handB: [-8, -38], footF: [7, 0], footB: [-7, 0],
      muzzle: [24, 0], weapon: [24, -48], grab: [22, -40]
    },
    grabPath: { hold: [[22, -40], [20, -42]], toss: [[18, -50], [30, -66], [44, -30]] },

    moves: {
      '5L': N('L', 'stand', 4, 3, 7,   { box: [8, -52, 16, 10], dmg: 30, adv: [3, 1] }),
      '5M': N('M', 'stand', 7, 4, 12,  { box: [14, -46, 24, 12], dmg: 60, adv: [2, -1] }),
      '5H': N('H', 'stand', 10, 5, 19, { box: [10, -74, 34, 44], dmg: 95, adv: [1, -4], air: 'knock' }),
      '2L': N('L', 'crouch', 4, 3, 8,  { box: [8, -14, 18, 10], dmg: 28, guard: 'low', adv: [2, 0] }),
      '2M': N('M', 'crouch', 7, 4, 13, { box: [12, -16, 28, 10], dmg: 55, guard: 'low', adv: [1, -2] }),
      '2H': N('H', 'crouch', 10, 5, 22, { box: [10, -12, 36, 12], dmg: 85, guard: 'low', kd: 'down', adv: [0, -9] }),
      'jL': N('L', 'air', 4, 8, 12,    { box: [2, -40, 20, 16], dmg: 32, guard: 'high', stun: [12, 9] }),
      'jM': N('M', 'air', 6, 6, 12,    { box: [4, -32, 24, 18], dmg: 58, guard: 'high', stun: [15, 11] }),
      'jH': N('H', 'air', 9, 6, 12,    { box: [0, -28, 30, 26], dmg: 88, guard: 'high', stun: [18, 13] }),

      'throw': {
        kind: 'throw', anim: 'throw',
        segs: [['startup', 5], ['active', 2], ['recovery', 22]], grabSeg: 'active'
      },
      throwHit: {
        kind: 'system', anim: 'throwHit',
        segs: [['hold', 16], ['toss', 14], ['recovery', 18]],
        inv: { all: [0, 30] }
      },

      wave: {
        kind: 'special', motion: '236', simple: 5, lore: 'wave',
        segs: [['startup', { L: 14, M: 15, H: 16 }], ['active', 3], ['recovery', 26]],
        proj: {
          seg: 'active', kind: 'wave', sprite: 'deepseek.wave', box: [-11, -20, 22, 20], ground: true,
          spawn: 'muzzle', spawnFb: [24, 0],
          vx: { L: 3.0, M: 3.3, H: 3.6 }, vy: 0, range: { L: 110, M: 200, H: 9999 },
          dmg: { L: 70, M: 80, H: 90 }, lv: 'S', stun: [22, 16], chip: 0.2, push: [8, 8],
          hitFx: 'deepseek.waveHit', hitSfx: 'deepseek.waveHit', castFx: 'deepseek.waveCast', castSfx: 'deepseek.wave'
        }
      },
      breach: {
        kind: 'special', motion: '623', simple: 6, lore: 'breach',
        segs: [
          ['startup', 5],
          ['rise', 12, { vy0: { L: -9.3, M: -11.6, H: -14.0 }, g: { L: 0.78, M: 0.97, H: 1.17 }, vx: { L: 1.2, M: 1.6, H: 2.0 } }],
          ['fall', 12, { loop: 'land', vx: 0.6, g: 0.55 }],
          ['land', 14]
        ],
        inv: { strike: { L: [0, 6], M: [0, 8], H: [0, 10] }, 'throw': [0, 40] },
        hits: [{
          seg: 'rise', fr: [0, 7], box: [0, -82, 30, 78], anchor: 'weapon', dmg: { L: 100, M: 120, H: 140 },
          lv: 'S', kd: 'launch', lvx: 1.5, lvy: -7.4, stun: [0, 18], fx: 'hit.special', jug: 2
        }],
        trail: 'deepseek.breachTrail', sfx: 'deepseek.breach'
      },
      chain: {
        kind: 'special', motion: '214', simple: 4, lore: 'chain', anim: 'chain1', step: 0,
        segs: [['startup', { L: 10, M: 9, H: 8 }, { vx: { L: 3.0, M: 3.9, H: 4.8 } }], ['active', 4, { vx: 1.2 }], ['recovery', 18]],
        follow: { to: 'chain2', from: ['active', 0], until: ['recovery', 14] },
        hits: [{ seg: 'active', box: [8, -54, 24, 18], anchor: 'weapon', dmg: { L: 55, M: 60, H: 65 }, lv: 'S',
          stun: [22, 15], push: [6, 8], fx: 'deepseek.chainHit', chip: 0.2 }],
        sfx: 'deepseek.chain'
      },
      chain2: {
        kind: 'special', internal: true, lore: 'chain', anim: 'chain2', step: 1,
        segs: [['startup', 7, { vx: 1.6 }], ['active', 4, { vx: 0.6 }], ['recovery', 20]],
        follow: { to: 'chain3', from: ['active', 0], until: ['recovery', 14] },
        hits: [{ seg: 'active', box: [6, -46, 24, 26], anchor: 'weapon', dmg: { L: 55, M: 60, H: 65 }, lv: 'S',
          stun: [22, 15], push: [6, 8], fx: 'deepseek.chainHit', chip: 0.2 }],
        sfx: 'deepseek.chain'
      },
      chain3: {
        kind: 'special', internal: true, lore: 'chain', anim: 'chain3', step: 2,
        segs: [['startup', 9, { vx: 1.2 }], ['active', 5], ['recovery', 26]],
        hits: [{ seg: 'active', box: [4, -82, 28, 46], anchor: 'weapon', dmg: { L: 85, M: 90, H: 95 }, lv: 'S',
          kd: 'launch', lvx: 1.4, lvy: -7.6, adv: [0, -12], push: [4, 12], fx: 'deepseek.chainHit', chip: 0.2 }],
        sfx: 'deepseek.chain'
      },
      dive: {
        kind: 'special', motion: '22', simple: 2, lore: 'dive', anim: 'diveIn',
        segs: [
          ['startup', 6], ['sink', 6],
          ['travel', { L: 10, M: 14, H: 18 }, { hide: true, noPush: true, anim: 'diveIn', as: 'sink' }],
          ['emerge', 6, { anim: 'diveOut', as: 'startup' }],
          ['active', 5, { anim: 'diveOut' }],
          ['recovery', 22, { anim: 'diveOut' }]
        ],
        inv: { all: { L: [6, 24], M: [6, 28], H: [6, 32] } },
        hits: [{ seg: 'active', box: [-16, -76, 36, 76], dmg: { L: 90, M: 100, H: 110 }, lv: 'S',
          kd: 'launch', lvx: 1.2, lvy: -6.8, adv: [0, -10], push: [4, 10], fx: 'hit.special', chip: 0.2 }],
        sfx: 'deepseek.dive'
      },
      diveKick: {
        kind: 'special', motion: '236', simple: 'j', air: true, minHeight: 22, lore: 'diveKick',
        segs: [
          ['startup', { L: 7, M: 8, H: 9 }, { vx: 0.4, vyc: -0.3, g: 0 }],
          ['active', 10, { loop: 'land', vx: { L: 3.0, M: 4.0, H: 5.0 }, vyc: { L: 5.6, M: 4.6, H: 3.8 }, g: 0 }],
          ['land', 12, { end: true }],
          ['bounce', 12, { loop: 'land', anim: 'jumpFall', as: 'loop', g: 0.42 }],
          ['bland', 5, { anim: 'land', as: 'go' }]
        ],
        hits: [{ seg: 'active', box: [0, -18, 26, 20], anchor: 'weapon', dmg: { L: 70, M: 80, H: 90 }, lv: 'S',
          guard: 'high', stun: [18, 12], push: [6, 8], fx: 'hit.special', bounce: true, chip: 0.15 }],
        trail: 'deepseek.diveTrail', sfx: 'deepseek.diveKick'
      },
      'super': {
        kind: 'super', motion: '236236', lore: 'super',
        segs: [['startup', 6], ['cast', 8], ['active', 44], ['recovery', 34]],
        inv: { all: [0, 15] },
        flashAt: 5,
        whale: { seg: 'active', x: 52 },
        hits: [{
          seg: 'active', fr: [4, 40], every: 6, box: [30, -116, 150, 116], dmg: 40, lv: 'X', stun: [16, 12], chip: 0.25,
          push: [0, 2], noCatch: true, juggleAny: true, lvx: 0, lvy: -3.0, air: 'knock', pull: 100, fx: 'deepseek.whaleSplash',
          final: { from: 40, dmg: 90, kd: 'launch', lvx: 2.4, lvy: -8.6, lv: 'H', fx: 'hit.heavy' }
        }],
        sfx: 'deepseek.whale'
      }
    }
  });
})();
