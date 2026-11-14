/* LATENT CLASH — FX: shared sprite helper (owned by FX).
 * The v1 Claude sprites that lived here (spark, guardrail, beam, book) were replaced in V2 by
 * claude-super.js (beam, book) and specials.js (spark, guardrail); only the mirror helper remains. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var FX = LC.fx = LC.fx || {};
  var I = FX._ = FX._ || {};
  /** Mirror helper: run fn with the context reflected around screen x = sx when facing < 0. */
  I.mirrored = function (ctx, sx, facing, fn) {
    if (facing >= 0) { fn(); return; }
    ctx.save(); ctx.translate(sx * 2, 0); ctx.scale(-1, 1); fn(); ctx.restore();
  };
})();
