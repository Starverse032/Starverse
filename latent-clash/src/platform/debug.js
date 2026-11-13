/* LATENT CLASH — LC.debug: test hooks (§7 of the contract) (PLATFORM).
 *   LC.debug.ready            Promise, resolved after boot + every module init()
 *   LC.debug.manual(on)       stop / restart the realtime loop
 *   LC.debug.step(n)          run n logic ticks, then render once (synchronous)
 *   LC.debug.setInput(i, s)   override player i's held input ({ right: true, L: true }); null = release
 *   LC.debug.goto(scene, p)   jump to a scene (no transition); 'match' accepts a createMatch config
 *   LC.debug.match()          current LC.fight match (or the stub) or null
 *   LC.debug.errors           uncaught errors / unhandled rejections / scene exceptions
 *   LC.debug.scene            name of the top scene
 * Extras: LC.debug.scenes() (registered names), LC.debug.initTimes, LC.debug.shot() (data URL).
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var resolveReady;
  var dbg = LC.debug = {
    errors: [],
    initTimes: {},
    ready: new Promise(function (r) { resolveReady = r; }),
    _resolveReady: function () { if (resolveReady) { resolveReady(true); resolveReady = null; } },
    manual: function (on) { LC.app.setManual(on === undefined ? true : on); return LC.app.isManual(); },
    step: function (n) { LC.app._step(Math.max(0, n == null ? 1 : n | 0)); return LC.app.ticks(); },
    setInput: function (i, state) { LC.input.setOverride(i, state || null); },
    goto: function (scene, params) {
      params = params || {};
      if (scene === 'match') {
        LC.scenes.go('match', { config: LC.app.matchConfig(params) }, { transition: 'none' });
      } else LC.scenes.go(scene, params, { transition: 'none' });
      return LC.scenes.name();
    },
    match: function () {
      var st = LC.scenes.stack;
      for (var i = st.length - 1; i >= 0; i--) if (st[i].match) return st[i].match;
      return null;
    },
    scenes: function () { return ['boot', 'title', 'menu', 'select', 'stage', 'vs', 'match', 'pause', 'result', 'ladder', 'continue', 'ending', 'credits', 'howto', 'options', 'keys'].filter(LC.scenes.has); },
    shot: function () { return LC.display.canvas.toDataURL('image/png'); }
  };
  Object.defineProperty(dbg, 'scene', { get: function () { return LC.scenes.name(); }, set: function () { /* read-only */ }, enumerable: true });

  window.addEventListener('error', function (e) {
    var msg = e && (e.message || (e.error && e.error.message)) || 'error';
    if (/ResizeObserver loop/.test(msg)) return;
    dbg.errors.push({ message: msg, source: e.filename, line: e.lineno, stack: e.error && e.error.stack });
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    dbg.errors.push({ message: 'unhandled rejection: ' + (r && r.message || r), stack: r && r.stack });
  });
})();
