/* LATENT CLASH — RIG: procedural helpers for authoring (locomotion cycles). */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var R = LC.rig = LC.rig || {};
  var I = R._ = R._ || {};
  var G = I.gen = {};

  // required hip height so a leg of length `leg` (hip→sole) reaches a foot dx away
  function reachY(leg, dx) { return -Math.sqrt(Math.max(0, leg * leg - dx * dx)); }
  G.reachY = reachY;

  // Alternating walk. v px/f (+ forward / - backward), loop frames (2 steps).
  // o: { lift, bob, leg (hip→sole length), hipX, swingF, swingB, lean, extra(key, phase) }
  G.walk = function (base, v, loop, o) {
    var L = Math.abs(v) * loop / 2, half = loop / 2, keys = [], leg = o.leg, x0 = v >= 0 ? L / 2 : -L / 2;
    for (var k = 0; k < 8; k++) {
      var t = k * loop / 8, step = k < 4 ? 0 : 1, ph = (k % 4) / 4, tau = ph * half;
      var plant = x0 - v * tau;                                  // planted foot
      var sw = -x0 + 2 * x0 * ph, swy = -o.lift * Math.sin(Math.PI * ph);   // swinging foot
      var spread = Math.max(Math.abs(plant), Math.abs(sw)) + 1.5;
      var hy = Math.max(reachY(leg * 0.985, spread), base.hip[1]) + o.bob * (1 - Math.sin(Math.PI * ph));
      var a = step === 0 ? 'F' : 'B';
      var pose = I.P(base, {
        hip: [o.hipX || 0, hy], lean: base.lean + (o.lean || 0),
        plant: a
      });
      pose[a === 'F' ? 'fF' : 'fB'] = [plant, 0];
      pose[a === 'F' ? 'fB' : 'fF'] = [sw, swy];
      var sgn = (a === 'F' ? 1 : -1) * (1 - 2 * ph);   // +1 when F leads
      if (o.swingF) pose.hF = [base.hF[0] - o.swingF * sgn, base.hF[1] + (hy - base.hip[1])];
      else pose.hF = [base.hF[0], base.hF[1] + (hy - base.hip[1])];
      if (o.swingB) pose.hB = [base.hB[0] + o.swingB * sgn, base.hB[1] + (hy - base.hip[1])];
      else pose.hB = [base.hB[0], base.hB[1] + (hy - base.hip[1])];
      if (o.extra) o.extra(pose, k, ph);
      keys.push([t, pose, 'linear']);
    }
    return keys;
  };

  // Boxer shuffle (lead foot steps, rear foot follows; feet never cross).
  // n shuffles per loop. Feet rest at fF0 / fB0 (local) at the start of each shuffle.
  G.shuffle = function (base, v, loop, n, o) {
    var d = loop / n, L = v * d, keys = [], fF0 = base.fF[0], fB0 = base.fB[0], leg = o.leg;
    var lead = v >= 0 ? 'F' : 'B';     // moving forward: front foot leads; backward: back foot leads
    for (var s = 0; s < n; s++) {
      for (var q = 0; q < 4; q++) {
        var t = s * d + q * d / 4, tau = q * d / 4;
        // world positions relative to the shuffle start; local = world - v*tau
        var lw, fw, ly = 0, fy = 0, plant;
        if (q < 2) { lw = L * (q / 2); fw = 0; ly = q === 1 ? -o.lift : 0; plant = lead === 'F' ? 'B' : 'F'; }
        else { lw = L; fw = L * ((q - 2) / 2); fy = q === 3 ? -o.lift * 0.7 : 0; plant = lead; }
        var fFx, fBx, fFy, fBy;
        if (lead === 'F') { fFx = fF0 + lw - v * tau; fBx = fB0 + fw - v * tau; fFy = ly; fBy = fy; }
        else { fBx = fB0 + lw - v * tau; fFx = fF0 + fw - v * tau; fBy = ly; fFy = fy; }
        var spread = Math.max(Math.abs(fFx), Math.abs(fBx)) + 2;
        var bobY = o.bob * (q === 1 || q === 3 ? -1 : 0.5);
        var hy = Math.max(reachY(leg * 0.985, spread), base.hip[1] + bobY);
        var dy = hy - base.hip[1];
        var pose = I.P(base, { hip: [base.hip[0], hy], fF: [fFx, fFy], fB: [fBx, fBy], plant: plant,
          hF: [base.hF[0], base.hF[1] + dy], hB: [base.hB[0], base.hB[1] + dy] });
        if (o.extra) o.extra(pose, s * 4 + q, q / 4);
        keys.push([t, pose, 'linear']);
      }
    }
    return keys;
  };
})();
