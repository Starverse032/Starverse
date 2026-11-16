/* LATENT CLASH — FIGHT: GPT 娘 (白发龙娘, CONTRACT-V2 §V2.5). Power character: slowest, highest
 * damage per hit, long tail normals, a 3-hit flame breath, an invulnerable rising claw, a command
 * grab (call → callHit), a point-blank roar that blows opponents away and erases projectiles, and
 * the full-screen super 注意力即一切 (target latched at cast f0, hit boxes from fx spriteInfo).
 * Boxes are [x, y, w, h] relative to the origin (feet), facing right, y negative = up.
 * Normals: box front edge = rig `weapon` anchor + 2 at the first active frame, centred on its y. */
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
    id: 'gpt',
    hp: 1000, height: 102,
    order: ['breath', 'dragonRise', 'call', 'roar', 'super'],
    // V2.5 body: 102 px tall (horns +8), crouch 68, push width 28; hurt boxes on the body only
    // (spread wings reach x -75, the resting tail lies to x -48, airborne hair/skirt hang 22 px low)
    walkF: 1.4, walkB: 1.1,
    jump: { vy: 7.45, g: 0.324, vxF: 2.6, vxB: 2.2 },          // apex ~82 px, 46f airtime
    dashF: { d: 70, f: 20 },
    dashB: { d: 60, f: 22, inv: 9 },
    push: { stand: [-14, -64, 28, 64], crouch: [-15, -48, 30, 48], air: [-12, -82, 24, 62], down: [-15, -26, 30, 26] },
    hurt: {
      stand: [[-9, -102, 20, 30], [-15, -72, 30, 72]],
      crouch: [[-16, -50, 34, 50], [2, -68, 24, 20]],
      air: [[-14, -100, 28, 84]],
      launch: [[-23, -77, 46, 64]]
    },
    throwRange: 58,
    projColor: 'accent',
    anchorFb: {
      head: [2, -92], chest: [0, -74], hip: [0, -52], center: [0, -54], top: [2, -110],
      handF: [22, -66], handB: [-10, -62], footF: [8, 0], footB: [-8, 0],
      muzzle: [23, -81], weapon: [22, -67], grab: [32, -66], tail: [-40, -20], mouth: [10, -86]
    },
    // victim path (grab point keyframes) when no rig: throwHit and callHit (hold → rise → slam)
    grabPath: {
      hold: [[32, -66], [24, -94]], toss: [[24, -96], [46, -46], [41, -41]],
      callhold: [[42, -64], [36, -64]], callrise: [[26, -105], [22, -126]], callslam: [[46, -54], [42, -10]]
    },

    moves: {
      // claw swipes (L, teal after-glow) · kicks through the slit (M) · tail lashes (H)
      '5L': N('L', 'stand', 6, 3, 9,    { box: [14, -70, 24, 14], dmg: 40, adv: [3, 1], fx: 'gpt.clawHit' }),
      '5M': N('M', 'stand', 9, 4, 15,   { box: [22, -71, 34, 16], dmg: 70, adv: [2, -2] }),
      '5H': N('H', 'stand', 13, 5, 24,  { box: [22, -80, 48, 42], dmg: 110, adv: [2, -6], air: 'knock', fx2: 'gpt.scales' }),
      '2L': N('L', 'crouch', 6, 3, 10,  { box: [16, -46, 24, 14], dmg: 36, guard: 'low', adv: [2, 0], fx: 'gpt.clawHit' }),
      '2M': N('M', 'crouch', 9, 4, 16,  { box: [22, -12, 36, 14], dmg: 66, guard: 'low', adv: [1, -3] }),
      '2H': N('H', 'crouch', 12, 5, 25, { box: [20, -22, 55, 22], dmg: 100, guard: 'low', kd: 'down', adv: [0, -12], fx2: 'gpt.scales' }),
      'jL': N('L', 'air', 5, 6, 12,     { box: [10, -64, 24, 18], dmg: 40, guard: 'high', stun: [12, 9], fx: 'gpt.clawHit' }),
      'jM': N('M', 'air', 8, 6, 12,     { box: [12, -40, 34, 24], dmg: 68, guard: 'high', stun: [15, 11] }),
      'jH': N('H', 'air', 11, 6, 12,    { box: [14, -30, 42, 36], dmg: 105, guard: 'high', stun: [19, 14], fx2: 'gpt.scales' }),

      'throw': {
        kind: 'throw', anim: 'throw',
        segs: [['startup', 5], ['active', 2], ['recovery', 22]], grabSeg: 'active'
      },
      throwHit: {
        kind: 'system', anim: 'throwHit',
        segs: [['hold', 16], ['toss', 14], ['recovery', 18]],
        inv: { all: [0, 30] }
      },

      // 龙息·生成: a 3-hit flame cone attached to the mouth (a strike, not a projectile: it is never
      // absorbed, reflected or clashed; noCatch: Claude's barrier does not catch it either)
      breath: {
        kind: 'special', motion: '236', simple: 5, lore: 'breath',
        segs: [['startup', { L: 11, M: 12, H: 13 }], ['active', 16], ['recovery', { L: 20, M: 22, H: 24 }]],
        flame: { length: { L: 60, M: 85, H: 110 }, angle: 0, grow: 6, mouthFb: [23, -81] },
        startFx: 'gpt.breathCast', activeSfx: 'gpt.breath',
        hits: [{
          seg: 'active', fr: [0, 15], every: 6, flame: true, dmg: { L: 30, M: 32, H: 34 }, lv: 'S',
          adv: [{ L: 2, M: 1, H: 0 }, { L: -6, M: -8, H: -10 }], push: [6, 8], chip: 0.2, fx: 'hit.special', noCatch: true,
          final: { from: 12, push: [14, 18] }
        }]
      },
      airBreath: {
        kind: 'special', motion: '236', simple: 'j', air: true, minHeight: 30, lore: 'breath',
        segs: [['startup', 10, { vyc: 0.3 }], ['active', 12, { vyc: 0.5 }], ['recovery', 12, { loop: 'land' }]],
        landLag: 8,
        flame: { length: { L: 60, M: 85, H: 110 }, angle: 45, grow: 4, mouthFb: [30, -76] },
        startFx: 'gpt.breathCast', activeSfx: 'gpt.breath',
        hits: [{
          seg: 'active', fr: [0, 11], every: 4, flame: true, dmg: { L: 26, M: 28, H: 30 }, lv: 'S',
          stun: [18, 12], push: [5, 6], chip: 0.2, fx: 'hit.special', noCatch: true
        }]
      },
      // 升龙·预训练: invulnerable start-up, anti-air, knock-down
      dragonRise: {
        kind: 'special', motion: '623', simple: 6, lore: 'dragonRise',
        segs: [
          ['startup', 5],
          ['rise', 14, { vy0: { L: -8.0, M: -10.0, H: -12.0 }, g: { L: 0.57, M: 0.71, H: 0.86 }, vx: { L: 1.2, M: 1.6, H: 2.0 } }],
          ['fall', 12, { loop: 'land', vx: 0.5, g: 0.6 }],
          ['land', 14]
        ],
        inv: { strike: { L: [0, 6], M: [0, 8], H: [0, 10] }, 'throw': [0, 40] },
        hits: [{
          seg: 'rise', fr: [0, 8], box: [0, -130, 44, 126], anchor: 'weapon', dmg: { L: 110, M: 130, H: 150 },
          lv: 'S', kd: 'launch', lvx: 1.6, lvy: -6.4, stun: [0, 18], fx: 'gpt.clawHit', fx2: 'hit.special', jug: 2, impact: true
        }],
        trail: 'gpt.riseTrail', trailSegs: ['rise'], sfx: 'gpt.rise'
      },
      // 函数调用: command grab — unblockable, no tech, grounded standing/crouching opponents that a
      // normal throw could take (not airborne / in stun / wake-up or post-stun protection / back-dash)
      call: {
        kind: 'special', motion: '214', simple: 4, lore: 'call',
        segs: [['startup', { L: 6, M: 7, H: 8 }], ['active', 3], ['recovery', { L: 28, M: 30, H: 32 }]],
        cmdGrab: { seg: 'active', range: { L: 56, M: 60, H: 64 }, to: 'callHit' }
      },
      // hold → rise → slam: her origin stays on the floor (the sprite lifts her); the victim follows
      // the `grab` anchor and is released (damage, hard knock-down) on the last slam frame
      callHit: {
        kind: 'special', internal: true, lore: 'call', anim: 'callHit',
        segs: [['hold', 14], ['rise', 16], ['slam', 12], ['recovery', 22]],
        inv: { all: [0, 52] },
        grabDmg: { L: 150, M: 170, H: 190 }, sfx: 'gpt.call'
      },
      // 系统提示: shock-wave circle around her chest; blows the opponent away, erases projectiles inside
      roar: {
        kind: 'special', motion: '22', simple: 2, lore: 'roar',
        segs: [['startup', 9], ['active', 6], ['recovery', { L: 22, M: 24, H: 26 }]],
        roar: { radius: { L: 56, M: 70, H: 84 }, center: 'chest', centerFb: [-2, -73] },
        activeFx: 'gpt.roarRing', sfx: 'gpt.roar',
        hits: [{
          seg: 'active', radius: true, dmg: { L: 80, M: 90, H: 100 }, lv: 'S', kd: 'launch',
          lvx: { L: 3.2, M: 3.6, H: 4.0 }, lvy: -4.2, adv: [0, -6], push: [0, { L: 30, M: 36, H: 42 }],
          chip: 0.2, fx: 'hit.special', impact: true, jug: 2
        }]
      },
      // 注意力即一切: target = the victim's chest at cast f0; comboed victims are pinned until the beams.
      // Hits on fx `gpt.attention` events (t from cast f0): 25 30 35 40 (orb) + 44 (burst)
      'super': {
        kind: 'super', motion: '236236', lore: 'super',
        segs: [['startup', 6], ['cast', 12], ['active', 50], ['recovery', 30]],
        inv: { all: [0, 19] },
        flashAt: 5, bgOut: 10,        // backdrop outro from recovery f10 (fx GPT timeline)
        attn: { pinT: 28 }, castSfx: 'gpt.super',
        hits: [{
          seg: 'active', fr: [13, 31], every: 5, attn: true, dmg: 55, lv: 'X', stun: [16, 10], chip: 0.25,
          push: [0, 0], noCatch: true, juggleAny: true, pin: true, fx: 'hit.special'
        }, {
          seg: 'active', fr: [32, 37], attn: true, dmg: 110, lv: 'H', stun: [0, 22], chip: 0.25,
          push: [0, 8], noCatch: true, juggleAny: true, kd: 'launch', lvx: 3.0, lvy: -6.4, fx: 'hit.heavy', impact: true
        }]
      }
    }
  });
})();
