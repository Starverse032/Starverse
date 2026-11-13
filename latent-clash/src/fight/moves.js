/* LATENT CLASH — FIGHT move data format + character registry.
 *
 * A move is plain data (see NOTES.md, "Move data format"):
 *   {
 *     kind: 'normal'|'special'|'super'|'throw'|'system',
 *     anim: 'spark',                       // default rig anim
 *     btn / stance                         // normals: 'L'|'M'|'H', 'stand'|'crouch'|'air'
 *     motion: '236'|'623'|'214'|'22'|'236236', simple: 5|6|4|2|'j'   // command
 *     air: true                            // performed airborne
 *     segs: [[id, frames, opts], ...]      // frames may be { L, M, H }
 *        opts: { anim, as (rig seg id), loop: 'land', vx, vy0, vyc, g, hide, noPush, end, inv }
 *     hits: [{ seg, fr: [a, b], box: [x, y, w, h], anchor, dmg, lv: 'L'|'M'|'H'|'S'|'X',
 *              guard: 'mid'|'low'|'high'|'none', adv: [hit, block] | stun: [hit, block],
 *              push: [hit, block], kd: 'down'|'launch', lvx, lvy, air: 'reset'|'knock',
 *              chip, every, final: { from, ...overrides }, jug, juggleAny, noCatch, fx, sfx }]
 *     proj: { seg, sprite, box, vx, vy, ground, range, dmg, lv, stun, chip, spawn, spawnFb, ... }
 *     inv: { strike: [a, b], throw: [a, b], all: [a, b] }   // move frames, inclusive
 *     follow: { to: 'chain2', from: [seg, f], until: [seg, f] }   // rekka
 *     cancel: 'chain' (normals) | 'super' (specials) | null
 *     catchSeg: 'hold'                     // counter stance window
 *     flashAt: 5                           // super flash at this move frame
 *   }
 * Every numeric field may be { L, M, H }; it is resolved with the move's strength. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var F = LC.fight = LC.fight || {};
  var STR = ['L', 'M', 'H'];

  function resolveSegs(segs, s) {
    var out = [], start = 0;
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i], o = sg[2] || {};
      var f = F.v(sg[1], s) | 0;
      var r = { id: sg[0], f: f, start: start, idx: i };
      for (var k in o) r[k] = F.v(o[k], s);
      if (!r.as) r.as = r.id;
      out.push(r);
      if (!r.loop) start += f;
    }
    return out;
  }

  function total(segs) {
    var t = 0;
    for (var i = 0; i < segs.length; i++) { if (segs[i].end && i < segs.length - 1) { t += segs[i].f; return t; } t += segs[i].f; }
    return t;
  }

  F.defineChar = function (def) {
    var moves = def.moves;
    for (var id in moves) {
      var mv = moves[id];
      mv.id = id;
      if (!mv.anim) mv.anim = id;
      if (!mv.kind) mv.kind = 'special';
      mv.res = {};
      for (var i = 0; i < STR.length; i++) {
        var s = STR[i];
        var segs = resolveSegs(mv.segs, s);
        mv.res[s] = { segs: segs, total: total(segs) };
      }
      (mv.hits || []).forEach(function (h, gi) { h.group = h.group != null ? h.group : gi; });
      if (mv.kind === 'normal') {
        mv.rank = { L: 1, M: 2, H: 3 }[mv.btn];
        if (mv.cancel === undefined) mv.cancel = 'chain';
      } else if (mv.kind === 'special') {
        if (mv.cancel === undefined) mv.cancel = 'super';
      }
    }
    // default anchors used when the rig cannot provide one
    def.anchorFb = def.anchorFb || {};
    F.chars[def.id] = def;
    return def;
  };

  F.seg = function (res, idx) { return res.segs[idx]; };

  // Rig anim timings as authored (contract §3.3) — used for looping-segment phase and as a
  // fallback when LC.rig.animInfo is missing.
  F.AUTHORED = {
    idle: { loop: 64 }, walkF: { loop: 40 }, walkB: { loop: 44 },
    crouchIn: { go: 4 }, crouch: { loop: 64 }, crouchOut: { go: 4 }, jumpSquat: { go: 4 },
    jumpRise: { loop: 12 }, jumpFall: { loop: 12 }, land: { go: 6 },
    dashF: { go: 18 }, dashB: { go: 20 }, guardStand: { loop: 30 }, guardCrouch: { loop: 30 },
    hitHigh: { reel: 18 }, hitLow: { reel: 18 }, hitCrouch: { reel: 18 }, launch: { loop: 24 },
    down: { impact: 10, lie: 30 }, getup: { rise: 24 }, thrown: { loop: 20 },
    'throw': { startup: 5, active: 2, recovery: 22 }, throwHit: { hold: 16, toss: 14, recovery: 18 },
    intro: { act: 100 }, win: { 'in': 30, loop: 60 }, lose: { 'in': 30, loop: 60 },
    'super': { startup: 6, cast: 10, active: 40, recovery: 30 },
    jL: { recovery: 12 }, jM: { recovery: 12 }, jH: { recovery: 12 },
    airSpark: { recovery: 12 }, sonnet: { fall: 12 }, breach: { fall: 12 }, diveKick: { active: 10 }
  };

  var infoCache = {};
  // authored length of a segment (for looping phase) — prefers the real rig's numbers
  F.segLen = function (ch, anim, seg) {
    var k = ch + '|' + anim;
    var info = infoCache[k];
    if (info === undefined) {
      info = null;
      if (F.mod('rig', 'animInfo')) {
        try {
          var ai = LC.rig.animInfo(ch, anim);
          if (ai && ai.segs) { info = {}; ai.segs.forEach(function (s) { info[s.id] = s.f; }); }
        } catch (e) { F.err('rig.animInfo', e); }
      }
      infoCache[k] = info;
    }
    var n = info && info[seg];
    if (!n) { var a = F.AUTHORED[anim]; n = a && a[seg]; }
    return n || 12;
  };
  F.clearAnimCache = function () { infoCache = {}; };
})();
