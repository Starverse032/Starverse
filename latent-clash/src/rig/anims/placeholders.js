/* LATENT CLASH — RIG: required animation list (contract §3.3) and placeholders.
 *
 * After every character's anim files have registered, init() calls
 * fillPlaceholders(): any required anim that is missing is created with the
 * contract's segment ids / frame counts as an *alias* of the closest finished
 * animation (marked placeholder: true in animInfo). Authors replace them by
 * simply defining the real anim in anims/<char>-attacks.js.
 * Segment lists here are the single source of truth for timing checks.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};

  function g(id, f, loop) { return [id, f, !!loop]; }
  function sar(s, a, r) { return [g('startup', s), g('active', a), g('recovery', r)]; }
  function jsar(s, a) { return [g('startup', s), g('active', a), g('recovery', 12, true)]; }

  var COMMON = {
    idle: [g('loop', 64, 1)],
    walkF: [g('loop', 32, 1)], walkB: [g('loop', 36, 1)],   // contract ~40/~44: shortened so strides fit the legs (see NOTES)
    crouchIn: [g('go', 4)], crouch: [g('loop', 64, 1)], crouchOut: [g('go', 4)],
    jumpSquat: [g('go', 4)], jumpRise: [g('loop', 12, 1)], jumpFall: [g('loop', 12, 1)], land: [g('go', 6)],
    dashF: [g('go', 18)], dashB: [g('go', 20)],
    guardStand: [g('loop', 30, 1)], guardCrouch: [g('loop', 30, 1)],
    hitHigh: [g('reel', 18)], hitLow: [g('reel', 18)], hitCrouch: [g('reel', 18)],
    launch: [g('loop', 24, 1)], down: [g('impact', 10), g('lie', 30, 1)], getup: [g('rise', 24)],
    thrown: [g('loop', 20, 1)], throw: [g('startup', 5), g('active', 2), g('recovery', 22)],
    throwHit: [g('hold', 16), g('toss', 14), g('recovery', 18)],
    intro: [g('act', 100)], win: [g('in', 30), g('loop', 60, 1)], lose: [g('in', 30), g('loop', 60, 1)],
    super: [g('startup', 6), g('cast', 10), g('active', 40), g('recovery', 30)]
  };

  var REQ = I.REQUIRED = {
    claude: Object.assign({}, COMMON, {
      '5L': sar(5, 3, 8), '5M': sar(8, 4, 14), '5H': sar(12, 5, 22),
      '2L': sar(5, 3, 9), '2M': sar(8, 4, 15), '2H': sar(11, 5, 24),
      jL: jsar(5, 6), jM: jsar(7, 6), jH: jsar(10, 6),
      spark: sar(13, 3, 28), airSpark: [g('startup', 10), g('active', 3), g('recovery', 12, true)],
      sonnet: [g('startup', 5), g('rise', 14), g('fall', 12, true), g('land', 12)],
      haiku: [g('startup', 9), g('hit1', 3), g('gap1', 6), g('hit2', 3), g('gap2', 6), g('hit3', 4), g('recovery', 20)],
      guardrail: [g('startup', 3), g('hold', 18), g('recovery', 22)],
      guardrailHit: sar(4, 4, 22)
    }),
    deepseek: Object.assign({}, COMMON, {
      dashF: [g('go', 16)], dashB: [g('go', 18)], walkB: [g('loop', 32, 1)],
      super: [g('startup', 6), g('cast', 8), g('active', 44), g('recovery', 34)],
      '5L': sar(4, 3, 7), '5M': sar(7, 4, 12), '5H': sar(10, 5, 19),
      '2L': sar(4, 3, 8), '2M': sar(7, 4, 13), '2H': sar(10, 5, 22),
      jL: jsar(4, 8), jM: jsar(6, 6), jH: jsar(9, 6),
      wave: sar(15, 3, 26),
      breach: [g('startup', 5), g('rise', 12), g('fall', 12, true), g('land', 14)],
      chain1: sar(9, 4, 18), chain2: sar(7, 4, 20), chain3: sar(9, 5, 26),
      diveIn: [g('startup', 6), g('sink', 6)],
      diveOut: sar(6, 5, 22),
      diveKick: [g('startup', 8), g('active', 10, true), g('land', 12)]
    })
  };

  // closest finished animation for each placeholder
  var ALIAS = {
    claude: {
      '5M': '5L', '2L': '5L', '2M': '5L', '2H': '5H', jL: 'jumpFall', jM: 'jumpFall', jH: 'jumpFall',
      airSpark: 'spark', sonnet: '5H', haiku: '5H', guardrail: 'guardStand', guardrailHit: '5H', super: 'spark'
    },
    deepseek: {
      '5M': '5L', '2L': '5L', '2M': '5L', '2H': '5H', jL: 'jumpFall', jM: 'jumpFall', jH: 'jumpFall',
      wave: '5H', chain1: '5L', chain2: '5H', chain3: 'breach', diveIn: 'crouchIn', diveOut: 'breach',
      diveKick: 'jumpFall', super: '5H'
    }
  };
  var FALLBACK = ['idle'];

  I.fillPlaceholders = function () {
    Object.keys(REQ).forEach(function (cid) {
      var have = I.ANIMS[cid] = I.ANIMS[cid] || {};
      Object.keys(REQ[cid]).forEach(function (name) {
        var segs = REQ[cid][name];
        if (have[name] && !have[name].placeholder) {
          // verify the authored timing matches the contract
          var a = have[name], ok = a.segs.length === segs.length && a.segs.every(function (s, i) {
            return s.id === segs[i][0] && s.f === segs[i][1] && !!s.loop === segs[i][2];
          });
          if (!ok) console.error('[rig] ' + cid + '.' + name + ': segments differ from the contract table');
          return;
        }
        var src = (ALIAS[cid] && ALIAS[cid][name]) || FALLBACK[0];
        if (!have[src] || have[src].placeholder) src = 'idle';
        if (!have[src]) return;
        I.defAnim(cid, name, { segs: segs, alias: src, placeholder: true });
      });
    });
  };
})();
