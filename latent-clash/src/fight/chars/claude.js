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
    hp: 1000, height: 104,
    order: ['spark', 'sonnet', 'haiku', 'guardrail', 'super'],   // move list (getMoveList)
    // V2 body (CONTRACT-V2 §V2.2): 104 px tall, crouch 70, push width 26
    walkF: 1.6, walkB: 1.2,
    jump: { vy: 7.92, g: 0.36, vxF: 2.9, vxB: 2.5 },          // apex ~84 px, 44f airtime
    dashF: { d: 76, f: 18 },
    dashB: { d: 64, f: 20, inv: 9 },
    push: { stand: [-13, -66, 26, 66], crouch: [-14, -50, 28, 50], air: [-11, -84, 22, 64], down: [-15, -26, 30, 26] },
    hurt: {
      stand: [[-9, -104, 20, 32], [-14, -74, 30, 74]],
      crouch: [[-16, -52, 34, 52], [2, -70, 24, 20]],
      air: [[-14, -102, 28, 84]],
      launch: [[-22, -78, 44, 64]]
    },
    throwRange: 58,
    projColor: 'accent',
    anchorFb: {
      head: [2, -95], chest: [1, -71], hip: [0, -53], center: [0, -56], top: [2, -107],
      handF: [22, -70], handB: [-10, -64], footF: [8, 0], footB: [-8, 0],
      muzzle: [40, -78], weapon: [22, -71], grab: [32, -72]
    },
    // throw victim path during throwHit when no rig: [seg, x, y] keyframes of the grab point
    grabPath: { hold: [[32, -76], [20, -76]], toss: [[46, -72], [56, -84], [60, -60]] },

    // normals: box front edge = designed reach + 2 (rig weapon anchor + 2), centred on the anchor y
    moves: {
      '5L': N('L', 'stand', 5, 3, 8,   { box: [19, -76, 24, 14], dmg: 35, adv: [3, 1] }),
      '5M': N('M', 'stand', 8, 4, 14,  { box: [28, -70, 34, 16], dmg: 65, adv: [2, -2] }),
      '5H': N('H', 'stand', 12, 5, 22, { box: [26, -87, 48, 50], dmg: 100, adv: [1, -5], air: 'knock' }),
      '2L': N('L', 'crouch', 5, 3, 9,  { box: [16, -14, 28, 14], dmg: 30, guard: 'low', adv: [2, 0] }),
      '2M': N('M', 'crouch', 8, 4, 15, { box: [24, -14, 40, 14], dmg: 60, guard: 'low', adv: [1, -3] }),
      '2H': N('H', 'crouch', 11, 5, 24, { box: [16, -24, 56, 22], dmg: 90, guard: 'low', kd: 'down', adv: [0, -10] }),
      'jL': N('L', 'air', 5, 6, 12,    { box: [11, -66, 28, 18], dmg: 35, guard: 'high', stun: [12, 9] }),
      'jM': N('M', 'air', 7, 6, 12,    { box: [12, -79, 36, 22], dmg: 60, guard: 'high', stun: [15, 11] }),
      'jH': N('H', 'air', 10, 6, 12,   { box: [17, -66, 44, 38], dmg: 90, guard: 'high', stun: [18, 13] }),

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
        segs: [['startup', { L: 14, M: 13, H: 12 }], ['active', 3], ['recovery', 25]],   // V2: 28 -> 25 (balance)
        proj: {
          // leaves the palm (muzzle ~(40,-78)) and settles to cruise height -62 so crouchers are hit
          seg: 'active', kind: 'spark', sprite: 'claude.spark', box: { L: [-9, -9, 18, 18], M: [-11, -11, 22, 22], H: [-13, -13, 26, 26] },
          spawn: 'muzzle', spawnFb: [40, -78], cruiseY: -62, power: { L: 0.3, M: 0.6, H: 1 },
          vx: { L: 3.0, M: 4.2, H: 5.4 }, vy: 0,
          dmg: { L: 70, M: 80, H: 90 }, lv: 'S', stun: [22, 16], chip: 0.2, push: [10, 10],
          hitFx: 'claude.sparkHit', hitSfx: 'claude.sparkHit', castFx: 'claude.sparkCast', castSfx: 'claude.spark'
        }
      },
      airSpark: {
        kind: 'special', motion: '236', simple: 'j', air: true, minHeight: 28, lore: 'spark',
        segs: [['startup', 10], ['active', 3], ['recovery', 12, { loop: 'land' }]],
        landLag: 6,
        proj: {
          seg: 'active', kind: 'spark', sprite: 'claude.spark', box: [-11, -11, 22, 22],
          spawn: 'muzzle', spawnFb: [36, -56], power: 0.6,
          vx: { L: 2.4, M: 3.2, H: 4.0 }, vy: { L: 3.3, M: 2.6, H: 2.0 }, diag: true,
          dmg: { L: 65, M: 70, H: 75 }, lv: 'S', stun: [20, 14], chip: 0.2, push: [8, 8],
          hitFx: 'claude.sparkHit', hitSfx: 'claude.sparkHit', castFx: 'claude.sparkCast', castSfx: 'claude.spark'
        }
      },
      sonnet: {
        kind: 'special', motion: '623', simple: 6, lore: 'sonnet',
        segs: [
          ['startup', 5],
          // rise heights ~54 / 70 / 83 px (V1 x1.2), same 14f rise
          ['rise', 14, { vy0: { L: -8.3, M: -10.7, H: -12.7 }, g: { L: 0.59, M: 0.76, H: 0.9 }, vx: { L: 1.3, M: 1.7, H: 2.1 } }],
          ['fall', 12, { loop: 'land', vx: 0.6, g: 0.6 }],
          ['land', 12]
        ],
        inv: { strike: { L: [0, 6], M: [0, 8], H: [0, 10] }, 'throw': [0, 40] },
        hits: [{
          seg: 'rise', fr: [0, 8], box: [0, -136, 46, 132], anchor: 'weapon', dmg: { L: 100, M: 120, H: 140 },
          lv: 'S', kd: 'launch', lvx: 1.6, lvy: -6.6, stun: [0, 18], fx: 'hit.special', jug: 2, impact: true
        }],
        trail: 'claude.sonnetTrail', trailEvery: 2, riseFx: 'claude.sonnetPillar', sfx: 'claude.sonnet'
      },
      haiku: {
        kind: 'special', motion: '214', simple: 4, lore: 'haiku',
        segs: [
          ['startup', { L: 10, M: 9, H: 8 }, { vx: { L: 1.3, M: 1.8, H: 2.3 } }],
          ['hit1', 3, { vx: { L: 1.6, M: 2.1, H: 2.6 } }], ['gap1', 6, { vx: { L: 1.6, M: 2.1, H: 2.6 } }],
          ['hit2', 3, { vx: { L: 1.6, M: 2.1, H: 2.6 } }], ['gap2', 6, { vx: { L: 1.6, M: 2.1, H: 2.6 } }],
          ['hit3', 4, { vx: { L: 1.8, M: 2.3, H: 2.9 } }], ['recovery', 20]
        ],
        // quill tip at the hits: (58,-44) rising, (54,-103) high, (70,-70) falling slash
        hits: [
          { seg: 'hit1', box: [10, -76, 52, 56], dmg: { L: 40, M: 50, H: 50 }, lv: 'S', stun: [20, 14], push: [4, 5], fx: 'hit.special', chip: 0.2 },
          { seg: 'hit2', box: [10, -110, 50, 80], dmg: { L: 56, M: 70, H: 70 }, lv: 'S', stun: [20, 14], push: [4, 5], fx: 'hit.special', chip: 0.2 },
          { seg: 'hit3', box: [12, -98, 62, 72], dmg: { L: 40, M: 50, H: 50 }, lv: 'S', kd: 'launch', lvx: 2.6, lvy: -4.6,
            adv: [0, { L: -3, M: -4, H: -7 }], push: [8, 13], fx: 'hit.special', chip: 0.2, impact: true }
        ],
        sfx: 'claude.haiku'
      },
      guardrail: {
        kind: 'special', motion: '22', simple: 2, lore: 'guardrail',
        segs: [['startup', 3], ['hold', { L: 12, M: 18, H: 24 }], ['recovery', { L: 18, M: 22, H: 26 }]],
        // catch box: from just in front of her body to the barrier front (fx bbox x 26..62, y -102..-6)
        catchSeg: 'hold', barrier: [8, -106, 54, 106], pullTo: 64,
        sfx: 'claude.guardrail'
      },
      guardrailHit: {
        kind: 'special', anim: 'guardrailHit', internal: true, lore: 'guardrail',
        segs: [['startup', 4], ['active', 4], ['recovery', 22]],
        inv: { all: [0, 9] },
        hits: [{
          seg: 'active', box: [4, -106, 80, 106], dmg: { L: 100, M: 120, H: 140 }, lv: 'S', guard: 'none',
          kd: 'launch', lvx: 3.2, lvy: -5.0, fx: 'hit.special', juggleAny: true, impact: true
        }]
      },
      'super': {
        kind: 'super', motion: '236236', lore: 'super',
        segs: [['startup', 6], ['cast', 10], ['active', 40], ['recovery', 30]],
        inv: { all: [0, 17] },
        flashAt: 5, bgOut: 12,        // backdrop outro from recovery f12 (fx V2 timeline)
        pagesAt: 4,                   // claude.pages at the book on cast f4
        // beam drawn at the muzzle (book centre ~(34,-82)); visual 80 px tall, hitbox 68
        beam: { seg: 'active', y: -116, h: 68, x0: 44, grow: 56, max: 420, fwd: 16 },   // fwd: book/beam origin ahead of the muzzle so the book does not hide her face
        hits: [{
          seg: 'active', fr: [0, 39], every: 4, beam: true, dmg: 33, lv: 'X', stun: [14, 10], chip: 0.25,
          push: [1, 2], noCatch: true, juggleAny: true, lvx: 0.6, lvy: -2.2, holdY: 40, air: 'knock', fx: 'claude.beamHit',
          final: { from: 36, kd: 'launch', lvx: 3.4, lvy: -6.2, lv: 'H', fx: 'hit.heavy', impact: true }
        }],
        sfx: 'claude.beam'
      }
    }
  });
})();
