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
    // V2 body (CONTRACT-V2 §V2.2): 98 px tall, crouch 66, push width 28
    walkF: 2.0, walkB: 1.5,
    jump: { vy: 8.57, g: 0.39, vxF: 3.2, vxB: 2.7 },          // apex ~90 px, 44f airtime
    dashF: { d: 92, f: 16 },
    dashB: { d: 72, f: 18, inv: 8 },
    push: { stand: [-14, -64, 28, 64], crouch: [-15, -48, 30, 48], air: [-12, -80, 24, 60], down: [-15, -26, 30, 26] },
    hurt: {
      stand: [[-10, -98, 22, 30], [-15, -70, 31, 70]],
      crouch: [[-16, -48, 34, 48], [4, -66, 24, 20]],
      air: [[-14, -96, 28, 80]],
      launch: [[-24, -76, 46, 62]]
    },
    throwRange: 56,
    projColor: 'accent',
    anchorFb: {
      head: [2, -86], chest: [1, -68], hip: [-1, -45], center: [0, -50], top: [0, -100],
      handF: [22, -57], handB: [-10, -55], footF: [8, 0], footB: [-8, 0],
      muzzle: [40, 0], weapon: [22, -56], grab: [30, -62]
    },
    grabPath: { hold: [[30, -64], [20, -70]], toss: [[36, -60], [42, -58], [46, -54]] },

    // normals: box front edge = designed reach + 2 (rig weapon anchor + 2), centred on the anchor y
    moves: {
      '5L': N('L', 'stand', 4, 3, 7,   { box: [12, -76, 22, 14], dmg: 32, adv: [3, 1] }),
      '5M': N('M', 'stand', 7, 4, 12,  { box: [20, -55, 32, 16], dmg: 64, adv: [2, -1] }),
      '5H': N('H', 'stand', 10, 5, 19, { box: [18, -66, 47, 54], dmg: 100, adv: [1, -4], air: 'knock' }),
      '2L': N('L', 'crouch', 4, 3, 8,  { box: [12, -44, 24, 14], dmg: 28, guard: 'low', adv: [2, 0] }),
      '2M': N('M', 'crouch', 7, 4, 13, { box: [16, -14, 38, 14], dmg: 58, guard: 'low', adv: [1, -2] }),
      '2H': N('H', 'crouch', 10, 5, 22, { box: [14, -52, 53, 38], dmg: 90, guard: 'low', kd: 'down', adv: [0, -9] }),
      'jL': N('L', 'air', 4, 8, 12,    { box: [10, -66, 22, 18], dmg: 32, guard: 'high', stun: [12, 9] }),
      'jM': N('M', 'air', 6, 6, 12,    { box: [10, -63, 32, 22], dmg: 58, guard: 'high', stun: [15, 11] }),
      'jH': N('H', 'air', 9, 6, 12,    { box: [12, -32, 38, 32], dmg: 92, guard: 'high', stun: [18, 13] }),

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
          // fx wave ~44x40 (bbox -24,-40,46,41); muzzle fixed at (40,0) where the fluke slaps the floor
          seg: 'active', kind: 'wave', sprite: 'deepseek.wave', box: [-17, -34, 34, 34], ground: true,
          spawn: 'muzzle', spawnFb: [40, 0],
          vx: { L: 3.4, M: 3.8, H: 4.2 }, vy: 0, range: { L: 140, M: 250, H: 9999 },
          dmg: { L: 70, M: 80, H: 90 }, lv: 'S', stun: [22, 16], chip: 0.2, push: [10, 10],
          hitFx: 'deepseek.waveHit', hitSfx: 'deepseek.waveHit', castFx: 'deepseek.waveCast', castSfx: 'deepseek.wave'
        }
      },
      breach: {
        kind: 'special', motion: '623', simple: 6, lore: 'breach',
        segs: [
          ['startup', 5],
          ['rise', 12, { vy0: { L: -11.2, M: -13.9, H: -16.8 }, g: { L: 0.94, M: 1.16, H: 1.4 }, vx: { L: 1.5, M: 2.0, H: 2.5 } }],
          ['fall', 12, { loop: 'land', vx: 0.7, g: 0.62 }],
          ['land', 14]
        ],
        inv: { strike: { L: [0, 6], M: [0, 8], H: [0, 10] }, 'throw': [0, 40] },
        hits: [{
          seg: 'rise', fr: [0, 7], box: [2, -122, 48, 116], anchor: 'weapon', dmg: { L: 100, M: 120, H: 140 },
          lv: 'S', kd: 'launch', lvx: 1.5, lvy: -7.4, stun: [0, 18], fx: 'hit.special', jug: 2, impact: true
        }],
        trail: 'deepseek.breachTrail', trailAnchor: 'tail', riseFx: 'deepseek.breachCrescent', sfx: 'deepseek.breach'
      },
      chain: {
        kind: 'special', motion: '214', simple: 4, lore: 'chain', anim: 'chain1', step: 0,
        segs: [['startup', { L: 9, M: 8, H: 7 }, { vx: { L: 4.2, M: 5.7, H: 7.0 } }], ['active', 4, { vx: 1.6 }], ['recovery', 18]],
        follow: { to: 'chain2', from: ['active', 0], until: ['recovery', 14] },
        hits: [{ seg: 'active', box: [14, -80, 34, 26], anchor: 'weapon', dmg: { L: 65, M: 70, H: 75 }, lv: 'S',
          stun: [22, 15], push: [8, 10], fx: 'deepseek.chainHit', chip: 0.2 }],
        sfx: 'deepseek.chain'
      },
      chain2: {
        kind: 'special', internal: true, lore: 'chain', anim: 'chain2', step: 1,
        segs: [['startup', 7, { vx: 2.1 }], ['active', 4, { vx: 0.8 }], ['recovery', 20]],
        follow: { to: 'chain3', from: ['active', 0], until: ['recovery', 14] },
        hits: [{ seg: 'active', box: [8, -74, 34, 34], anchor: 'weapon', dmg: { L: 55, M: 60, H: 65 }, lv: 'S',
          stun: [22, 15], push: [8, 10], fx: 'deepseek.chainHit', chip: 0.2 }],
        sfx: 'deepseek.chain'
      },
      chain3: {
        kind: 'special', internal: true, lore: 'chain', anim: 'chain3', step: 2,
        segs: [['startup', 9, { vx: 1.6 }], ['active', 5], ['recovery', 26]],
        hits: [{ seg: 'active', box: [4, -122, 36, 82], anchor: 'weapon', dmg: { L: 95, M: 100, H: 105 }, lv: 'S',
          kd: 'launch', lvx: 1.4, lvy: -7.6, adv: [0, -12], push: [5, 15], fx: 'deepseek.chainHit', chip: 0.2, impact: true }],
        sfx: 'deepseek.chain'
      },
      dive: {
        kind: 'special', motion: '22', simple: 2, lore: 'dive', anim: 'diveIn',
        // M: surfaces `near` px in front of the opponent (max `far` px travel); H: `behind` px behind them
        dist: { near: 44, far: 124, behind: 40 }, clipFloor: true,
        segs: [
          ['startup', 6], ['sink', 6],
          ['travel', { L: 10, M: 14, H: 18 }, { hide: true, noPush: true, anim: 'diveIn', as: 'sink' }],
          ['emerge', 6, { anim: 'diveOut', as: 'startup' }],
          ['active', 5, { anim: 'diveOut' }],
          ['recovery', 22, { anim: 'diveOut' }]
        ],
        inv: { all: { L: [6, 24], M: [6, 28], H: [6, 32] } },
        hits: [{ seg: 'active', box: [-22, -116, 58, 116], dmg: { L: 90, M: 100, H: 110 }, lv: 'S',
          kd: 'launch', lvx: 1.2, lvy: -6.8, adv: [0, -10], push: [5, 13], fx: 'hit.special', chip: 0.2, impact: true }],
        sfx: 'deepseek.dive'
      },
      diveKick: {
        kind: 'special', motion: '236', simple: 'j', air: true, minHeight: 32, lore: 'diveKick',
        segs: [
          ['startup', { L: 7, M: 8, H: 9 }, { vx: 0.5, vyc: -0.4, g: 0 }],
          ['active', 10, { loop: 'land', vx: { L: 3.8, M: 5.0, H: 6.2 }, vyc: { L: 7.0, M: 5.8, H: 4.8 }, g: 0 }],
          ['land', 12, { end: true }],
          ['bounce', 12, { loop: 'land', anim: 'jumpFall', as: 'loop', g: 0.47 }],
          ['bland', 5, { anim: 'land', as: 'go' }]
        ],
        hits: [{ seg: 'active', box: [6, -24, 32, 26], anchor: 'weapon', dmg: { L: 70, M: 80, H: 90 }, lv: 'S',
          guard: 'high', stun: [18, 12], push: [8, 10], fx: 'hit.special', bounce: true, chip: 0.15 }],
        trail: 'deepseek.diveTrail', sfx: 'deepseek.diveKick'
      },
      'super': {
        kind: 'super', motion: '236236', lore: 'super',
        segs: [['startup', 6], ['cast', 8], ['active', 44], ['recovery', 34]],
        inv: { all: [0, 15] },
        flashAt: 5,
        // whale sprite t = 0 at cast f0 (fx V2 timeline); origin = her x + facing*52
        whale: { seg: 'active', x: 52, t0: 'cast' },
        hits: [{
          // whale t 8..44: holds and carries the victim forward (pull grows with whale t), final at the crash
          seg: 'active', fr: [0, 38], every: 6, whaleBox: true, box: [40, -150, 220, 150], dmg: 40, lv: 'X', stun: [16, 12], chip: 0.25,
          push: [0, 2], noCatch: true, juggleAny: true, lvx: 0, lvy: -3.0, holdY: 64, air: 'knock', pull: 110, pullGrow: 3, fx: 'deepseek.whaleSplash',
          final: { from: 36, dmg: 90, kd: 'launch', lvx: 2.4, lvy: -8.6, lv: 'H', fx: 'hit.heavy', impact: true }
        }, {
          // the tidal wave after the crash: hits grounded opponents only (a juggled victim is already done)
          seg: 'recovery', fr: [0, 30], tidalBox: true, box: [200, -70, 120, 70], dmg: 60, lv: 'H', stun: [24, 18], chip: 0.25,
          push: [16, 14], noCatch: true, jug: 99, kd: 'launch', lvx: 3.0, lvy: -5.0, fx: 'deepseek.waveHit', impact: true
        }],
        sfx: 'deepseek.whale'
      }
    }
  });
})();
