/* LATENT CLASH — FIGHT: Gemini 娘 (cat-girl trickster, CONTRACT-V2 §V2.6). The most mobile fighter,
 * lowest damage per hit: fast claw swipes (L), platform-shoe kicks (M), spinning tail-and-heel
 * attacks (H), a double jump, angled star projectiles (H hits twice), an invulnerable rising claw,
 * the light-twin (an engine entity that claws on its own after a delay, see twin.js), a short
 * teleport (blink; H swaps places with the twin) and the full-screen super 双子座·流星雨.
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
  var STAR_FX = { poseSpawn: true, hitFx: 'gemini.starHit', hitSfx: 'gemini.starHit', castFx: 'gemini.starCast', castSfx: 'gemini.star', blockFx: true };
  function star(o) { for (var k in STAR_FX) o[k] = STAR_FX[k]; return o; }

  F.defineChar({
    id: 'gemini',
    hp: 1000, height: 96,
    order: ['star', 'starRise', 'twin', 'blink', 'super'],
    // V2.6 body: 96 px to the crown (ears +8), crouch 64 (leans forward: head at x ≈ 18), push width 24;
    // hurt boxes on the body only (hair mass to x -44, tail tip (-38,-33), coat tails / sleeves excluded)
    walkF: 1.8, walkB: 1.5,
    jump: { vy: 8.19, g: 0.372, vxF: 3.1, vxB: 2.7 },          // apex ≈ 86 px, 44f airtime
    airJump: { vy: 6.85, vxF: 2.7, vxB: 2.4, frames: 6 },      // double jump: ≈ 60 px more, `airJump` flip go 6
    dashF: { d: 84, f: 16 },
    dashB: { d: 70, f: 18, inv: 8 },
    push: { stand: [-12, -62, 24, 62], crouch: [-13, -46, 26, 46], air: [-11, -78, 22, 58], down: [-15, -26, 30, 26] },
    hurt: {
      stand: [[-9, -96, 19, 28], [-14, -68, 27, 68]],
      crouch: [[-15, -46, 32, 46], [6, -64, 24, 20]],
      air: [[-13, -92, 26, 76]],
      launch: [[-22, -72, 44, 60]]
    },
    throwRange: 54,
    projColor: 'accent',
    anchorFb: {
      head: [2, -87], chest: [0, -70], hip: [0, -50], center: [1, -65], top: [-4, -106],
      handF: [17, -61], handB: [4, -60], footF: [7, 0], footB: [-7, 0],
      muzzle: [34, -75], weapon: [23, -61], grab: [30, -62], tail: [-38, -33], star: [-29, -84]
    },
    grabPath: { hold: [[30, -62], [24, -62]], toss: [[36, -62], [46, -64], [56, -42]] },

    moves: {
      // claw swipes (L) · platform-shoe kicks (M) · spinning tail-and-heel attacks (H)
      '5L': N('L', 'stand', 4, 3, 7,   { box: [10, -68, 22, 14], dmg: 28, adv: [3, 1], fx: 'gemini.clawHit' }),
      '5M': N('M', 'stand', 7, 4, 12,  { box: [20, -61, 30, 16], dmg: 55, adv: [2, -1] }),
      '5H': N('H', 'stand', 10, 5, 20, { box: [16, -76, 44, 44], dmg: 85, adv: [1, -5], air: 'knock' }),
      '2L': N('L', 'crouch', 4, 3, 8,  { box: [11, -21, 22, 14], dmg: 26, guard: 'low', adv: [2, 0], fx: 'gemini.clawHit' }),
      '2M': N('M', 'crouch', 7, 4, 13, { box: [17, -14, 36, 14], dmg: 52, guard: 'low', adv: [1, -2] }),
      '2H': N('H', 'crouch', 10, 5, 22, { box: [12, -16, 50, 20], dmg: 80, guard: 'low', kd: 'down', adv: [0, -9] }),
      'jL': N('L', 'air', 4, 8, 12,    { box: [9, -59, 20, 18], dmg: 28, guard: 'high', stun: [12, 9], fx: 'gemini.clawHit' }),
      'jM': N('M', 'air', 6, 6, 12,    { box: [10, -38, 30, 22], dmg: 52, guard: 'high', stun: [15, 11] }),
      'jH': N('H', 'air', 9, 6, 12,    { box: [12, -49, 36, 32], dmg: 80, guard: 'high', stun: [18, 13] }),

      'throw': {
        kind: 'throw', anim: 'throw',
        segs: [['startup', 5], ['active', 2], ['recovery', 22]], grabSeg: 'active'
      },
      throwHit: {
        kind: 'system', anim: 'throwHit',
        segs: [['hold', 16], ['toss', 14], ['recovery', 18]],
        inv: { all: [0, 30] }
      },

      // 星闪: one star on screen. L fast + straight (settles to -64: hits crouchers), M ≈ 20° upward
      // (catches jumps, flies over a standing opponent at long range), H big + slow, hits twice
      star: {
        kind: 'special', motion: '236', simple: 5, lore: 'star',
        segs: [['startup', 11], ['active', 3], ['recovery', 24]],
        proj: star({
          seg: 'active', kind: 'star', sprite: 'gemini.star', absAngle: true,
          box: { L: [-8, -8, 16, 16], M: [-10, -10, 20, 20], H: [-14, -14, 28, 28] },
          spawn: 'muzzle', spawnFb: [34, -75], cruiseY: { L: -64, M: null, H: -66 }, power: { L: 0.3, M: 0.6, H: 1 },
          vx: { L: 5.2, M: 3.9, H: 2.4 }, vy: { L: 0, M: -1.42, H: 0 },
          hits: { L: 1, M: 1, H: 2 }, rehit: 10,
          dmg: { L: 60, M: 60, H: 42 }, lv: 'S', stun: [22, 16], chip: 0.2, push: [10, 10]
        })
      },
      airStar: {
        kind: 'special', motion: '236', simple: 'j', air: true, minHeight: 30, lore: 'star',
        segs: [['startup', 9], ['active', 3], ['recovery', 12, { loop: 'land' }]],
        landLag: 6,
        proj: star({
          seg: 'active', kind: 'star', sprite: 'gemini.star', absAngle: true, box: [-10, -10, 20, 20],
          spawn: 'muzzle', spawnFb: [28, -46], power: 0.6,
          vx: { L: 2.6, M: 3.2, H: 3.8 }, vy: { L: 2.6, M: 3.2, H: 3.8 }, diag: true,   // 45° down-forward
          dmg: 55, lv: 'S', stun: [20, 14], chip: 0.2, push: [8, 8]
        })
      },
      // 双子升星: invulnerable start-up, anti-air, knock-down (claw stays over her head: x +6..+18)
      starRise: {
        kind: 'special', motion: '623', simple: 6, lore: 'starRise',
        segs: [
          ['startup', 4],
          ['rise', 12, { vy0: { L: -8.6, M: -10.4, H: -12.2 }, g: { L: 0.72, M: 0.87, H: 1.02 }, vx: { L: 1.2, M: 1.6, H: 2.0 } }],
          ['fall', 12, { loop: 'land', vx: 0.5, g: 0.6 }],
          ['land', 14]
        ],
        inv: { strike: { L: [0, 5], M: [0, 7], H: [0, 9] }, 'throw': [0, 36] },
        hits: [{
          seg: 'rise', fr: [0, 7], box: [0, -122, 40, 118], anchor: 'weapon', dmg: { L: 90, M: 105, H: 120 },
          lv: 'S', kd: 'launch', lvx: 1.5, lvy: -6.6, stun: [0, 18], fx: 'gemini.clawHit', fx2: 'hit.special', jug: 2, impact: true
        }],
        trail: 'gemini.riseTrail', trailSegs: ['rise'], sfx: 'gemini.rise'
      },
      // 双子·分身: the gesture; the light-twin appears on active f0 (twin.js). L: where she stands, strikes
      // ≈ 36f later · M: waits 8f, dashes up to 110 px forward in 14f (stops 36 px in front of the opponent), strikes · H: behind the opponent (≤ 200 px
      // away, else in front), strikes ≈ 44f later. One twin at a time.
      twin: {
        kind: 'special', motion: '214', simple: 4, lore: 'twin',
        segs: [['startup', 10], ['active', 2], ['recovery', 18]],
        twin: { seg: 'active', wait: { L: 28, M: 8, H: 36 }, dash: 110, dashF: 14, stopAt: 36, behind: 34, near: 200 },
        cancel: 'super'
      },
      // performed by the twin (never by her): one mid claw, 70 damage, combo-able stun
      twinStrike: {
        kind: 'special', internal: true, lore: 'twin', anim: 'twinStrike',
        segs: [['startup', 8], ['active', 4], ['recovery', 14]],
        hits: [{ seg: 'active', box: [14, -62, 34, 30], dmg: 70, lv: 'S', guard: 'mid', stun: [26, 16], push: [6, 10], src: 'twin',
          chip: 0.2, fx: 'gemini.clawHit', fx2: 'hit.special' }]
      },
      // 闪现: blinkOut → hidden → blinkIn. Invulnerable from vanish f0 to recovery f0 (2f after she is
      // drawn again at appear f3), then 8 vulnerable recovery frames. L 90 px back · M 110 px forward
      // through the opponent · H swaps with her twin, else up-forward into the air (she can act as she falls)
      blink: {
        kind: 'special', motion: '22', simple: 2, lore: 'blink', anim: 'blinkOut',
        blink: { back: 90, fwd: 110, pass: 34, airX: 70, airY: 72 },
        segs: [
          ['startup', 5, { anim: 'blinkOut' }],
          ['vanish', 5, { anim: 'blinkOut', noPush: true }],
          ['gone', { L: 2, M: 3, H: 4 }, { hide: true, noPush: true, anim: 'blinkOut', as: 'vanish' }],
          ['appear', 5, { anim: 'blinkIn', noPush: true, g: 0.12 }],
          ['recovery', 9, { anim: 'blinkIn', airEnd: true }]
        ],
        inv: { all: { L: [5, 17], M: [5, 18], H: [5, 19] } },
        sfx: 'gemini.blink'
      },
      // 双子座·流星雨: she and the twin take opposite sides (a twin is made for the super at the flash);
      // fx gemini.meteor t = frames since cast f0; hits on t 21 31 41 50 (meteor waves, X beams) + 57 (burst),
      // boxes = spriteInfo('gemini.meteor').frames[t] (screen space; the floor lane), 320 raw, blockable
      'super': {
        kind: 'super', motion: '236236', lore: 'super',
        segs: [['startup', 6], ['cast', 12], ['active', 54], ['recovery', 28]],
        inv: { all: [0, 19] },
        flashAt: 5, bgOut: 12,
        meteor: { pinT: 24, twinEdge: 44, twinOut: 10 }, castSfx: 'gemini.super',
        hits: [{
          seg: 'active', at: [9, 19, 29, 38], meteor: true, dmg: 50, lv: 'X', stun: [22, 16], chip: 0.25,
          push: [2, 2], noCatch: true, juggleAny: true, lvx: 0.4, lvy: -2.6, holdY: 36, air: 'knock', fx: 'gemini.starHit'
        }, {
          seg: 'active', at: [45], meteor: true, dmg: 120, lv: 'H', stun: [0, 22], chip: 0.25,
          push: [0, 10], noCatch: true, juggleAny: true, kd: 'launch', lvx: 3.0, lvy: -6.4, fx: 'hit.heavy', impact: true
        }]
      }
    }
  });
})();
