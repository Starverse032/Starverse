/* LATENT CLASH — FIGHT: Claude 娘 (星芒书记官). Balanced mid-range, long reach, a bit slower.
 * Boxes are [x, y, w, h] relative to the origin (feet), facing right, y negative = up.
 * The front edge of each normal's box (x + w) matches the reach guide of contract §3.3. */
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
    id: 'claude',
    hp: 1000,
    walkF: 1.3, walkB: 1.0,
    jump: { vy: 6.2, g: 0.31, vxF: 2.5, vxB: 2.2 },
    dashF: { d: 56, f: 18 },
    dashB: { d: 48, f: 20, inv: 9 },
    push: { stand: [-11, -44, 22, 44], crouch: [-12, -34, 24, 34], air: [-9, -52, 18, 40] },
    hurt: {
      stand: [[-9, -70, 18, 24], [-13, -48, 26, 48]],
      crouch: [[-14, -46, 28, 46]],
      air: [[-11, -64, 22, 50]]
    },
    throwRange: 46,
    projColor: 'accent',
    anchorFb: {
      head: [2, -62], chest: [2, -46], hip: [0, -30], center: [0, -38], top: [0, -80],
      handF: [16, -44], handB: [-8, -40], footF: [7, 0], footB: [-7, 0],
      muzzle: [32, -50], weapon: [30, -50], grab: [26, -44]
    },
    // throw victim path during throwHit when no rig: [seg, x, y] keyframes of the grab point
    grabPath: { hold: [[24, -44], [22, -46]], toss: [[20, -52], [-4, -70], [-22, -40]] },

    moves: {
      '5L': N('L', 'stand', 5, 3, 8,   { box: [12, -56, 18, 10], dmg: 35, adv: [3, 1] }),
      '5M': N('M', 'stand', 8, 4, 14,  { box: [20, -50, 26, 12], dmg: 65, adv: [2, -2] }),
      '5H': N('H', 'stand', 12, 5, 22, { box: [18, -76, 36, 34], dmg: 100, adv: [1, -5], air: 'knock' }),
      '2L': N('L', 'crouch', 5, 3, 9,  { box: [10, -16, 22, 10], dmg: 30, guard: 'low', adv: [2, 0] }),
      '2M': N('M', 'crouch', 8, 4, 15, { box: [16, -14, 32, 10], dmg: 60, guard: 'low', adv: [1, -3] }),
      '2H': N('H', 'crouch', 11, 5, 24, { box: [14, -12, 42, 12], dmg: 90, guard: 'low', kd: 'down', adv: [0, -10] }),
      'jL': N('L', 'air', 5, 6, 12,    { box: [4, -42, 22, 16], dmg: 35, guard: 'high', stun: [12, 9] }),
      'jM': N('M', 'air', 7, 6, 12,    { box: [6, -36, 28, 18], dmg: 60, guard: 'high', stun: [15, 11] }),
      'jH': N('H', 'air', 10, 6, 12,   { box: [2, -32, 34, 28], dmg: 90, guard: 'high', stun: [18, 13] }),

      'throw': {
        kind: 'throw', anim: 'throw',
        segs: [['startup', 5], ['active', 2], ['recovery', 22]], grabSeg: 'active'
      },
      throwHit: {
        kind: 'system', anim: 'throwHit',
        segs: [['hold', 16], ['toss', 14], ['recovery', 18]],
        inv: { all: [0, 30] }
      },

      spark: {
        kind: 'special', motion: '236', simple: 5, lore: 'spark',
        segs: [['startup', { L: 14, M: 13, H: 12 }], ['active', 3], ['recovery', 28]],
        proj: {
          seg: 'active', kind: 'spark', sprite: 'claude.spark', box: [-7, -7, 14, 14],
          spawn: 'muzzle', spawnFb: [32, -50],
          vx: { L: 2.6, M: 3.6, H: 4.8 }, vy: 0,
          dmg: { L: 70, M: 80, H: 90 }, lv: 'S', stun: [22, 16], chip: 0.2, push: [8, 8],
          hitFx: 'claude.sparkHit', hitSfx: 'claude.sparkHit', castFx: 'claude.sparkCast', castSfx: 'claude.spark'
        }
      },
      airSpark: {
        kind: 'special', motion: '236', simple: 'j', air: true, minHeight: 18, lore: 'spark',
        segs: [['startup', 10], ['active', 3], ['recovery', 12, { loop: 'land' }]],
        landLag: 6,
        proj: {
          seg: 'active', kind: 'spark', sprite: 'claude.spark', box: [-7, -7, 14, 14],
          spawn: 'muzzle', spawnFb: [26, -36],
          vx: { L: 2.0, M: 2.7, H: 3.4 }, vy: { L: 2.8, M: 2.2, H: 1.7 }, diag: true,
          dmg: { L: 65, M: 70, H: 75 }, lv: 'S', stun: [20, 14], chip: 0.2, push: [6, 6],
          hitFx: 'claude.sparkHit', hitSfx: 'claude.sparkHit', castFx: 'claude.sparkCast', castSfx: 'claude.spark'
        }
      },
      sonnet: {
        kind: 'special', motion: '623', simple: 6, lore: 'sonnet',
        segs: [
          ['startup', 5],
          ['rise', 14, { vy0: { L: -6.9, M: -8.9, H: -10.6 }, g: { L: 0.49, M: 0.63, H: 0.76 }, vx: { L: 1.0, M: 1.3, H: 1.6 } }],
          ['fall', 12, { loop: 'land', vx: 0.5, g: 0.5 }],
          ['land', 12]
        ],
        inv: { strike: { L: [0, 6], M: [0, 8], H: [0, 10] }, 'throw': [0, 40] },
        hits: [{
          seg: 'rise', fr: [0, 8], box: [2, -84, 28, 80], anchor: 'weapon', dmg: { L: 100, M: 120, H: 140 },
          lv: 'S', kd: 'launch', lvx: 1.6, lvy: -6.6, stun: [0, 18], fx: 'hit.special', jug: 2
        }],
        trail: 'claude.sonnetTrail', sfx: 'claude.sonnet'
      },
      haiku: {
        kind: 'special', motion: '214', simple: 4, lore: 'haiku',
        segs: [
          ['startup', { L: 10, M: 9, H: 8 }, { vx: { L: 1.0, M: 1.4, H: 1.8 } }],
          ['hit1', 3, { vx: { L: 1.2, M: 1.6, H: 2.0 } }], ['gap1', 6, { vx: { L: 1.2, M: 1.6, H: 2.0 } }],
          ['hit2', 3, { vx: { L: 1.2, M: 1.6, H: 2.0 } }], ['gap2', 6, { vx: { L: 1.2, M: 1.6, H: 2.0 } }],
          ['hit3', 4, { vx: { L: 1.4, M: 1.8, H: 2.2 } }], ['recovery', 20]
        ],
        hits: [
          { seg: 'hit1', box: [6, -62, 36, 36], dmg: { L: 40, M: 50, H: 50 }, lv: 'S', stun: [20, 14], push: [3, 4], fx: 'claude.haikuSlash', fxIndex: 0, chip: 0.2 },
          { seg: 'hit2', box: [6, -58, 38, 38], dmg: { L: 56, M: 70, H: 70 }, lv: 'S', stun: [20, 14], push: [3, 4], fx: 'claude.haikuSlash', fxIndex: 1, chip: 0.2 },
          { seg: 'hit3', box: [6, -60, 40, 42], dmg: { L: 40, M: 50, H: 50 }, lv: 'S', kd: 'launch', lvx: 2.6, lvy: -4.6,
            adv: [0, { L: -4, M: -6, H: -9 }], push: [6, 10], fx: 'claude.haikuSlash', fxIndex: 2, chip: 0.2 }
        ],
        sfx: 'claude.haiku'
      },
      guardrail: {
        kind: 'special', motion: '22', simple: 2, lore: 'guardrail',
        segs: [['startup', 3], ['hold', { L: 12, M: 18, H: 24 }], ['recovery', { L: 18, M: 22, H: 26 }]],
        catchSeg: 'hold', barrier: [6, -62, 26, 62],
        sfx: 'claude.guardrail'
      },
      guardrailHit: {
        kind: 'special', anim: 'guardrailHit', internal: true, lore: 'guardrail',
        segs: [['startup', 4], ['active', 4], ['recovery', 22]],
        inv: { all: [0, 9] },
        hits: [{
          seg: 'active', box: [2, -72, 66, 72], dmg: { L: 100, M: 120, H: 140 }, lv: 'S', guard: 'none',
          kd: 'launch', lvx: 3.2, lvy: -5.0, fx: 'hit.special', juggleAny: true
        }]
      },
      'super': {
        kind: 'super', motion: '236236', lore: 'super',
        segs: [['startup', 6], ['cast', 10], ['active', 40], ['recovery', 30]],
        inv: { all: [0, 17] },
        flashAt: 5,
        beam: { seg: 'active', y: -64, h: 46, x0: 18, grow: 64, max: 440 },
        hits: [{
          seg: 'active', fr: [0, 39], every: 4, beam: true, dmg: 33, lv: 'X', stun: [14, 10], chip: 0.25,
          push: [1, 2], noCatch: true, juggleAny: true, lvx: 0.6, lvy: -2.2, holdY: 34, air: 'knock', fx: 'claude.beamHit',
          final: { from: 36, kd: 'launch', lvx: 3.4, lvy: -6.2, lv: 'H', fx: 'hit.heavy' }
        }],
        sfx: 'claude.beam'
      }
    }
  });
})();
