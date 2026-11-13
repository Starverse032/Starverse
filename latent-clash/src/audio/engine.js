/* LATENT CLASH — public audio API (AUDIO module).  LC.audio.*  (contract §5.7)
 *
 * Lifecycle: init() is safe before any gesture and creates nothing audible. unlock() (call it in a
 * user gesture; init() also installs capture-phase gesture listeners that call it) creates/resumes
 * the AudioContext, builds the Mixer, renders the drum kit and then the SFX cache in the background.
 * While locked / suspended / unsupported every call is a silent no-op; music() requested while
 * locked is remembered and starts on unlock. The context is suspended while the tab is hidden. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var A = LC.audio = LC.audio || {};
  var K = A._;
  var AC = window.AudioContext || window.webkitAudioContext;
  var LOOKAHEAD = 0.3, TICK_MS = 40;
  var VOICE_KINDS = ['light', 'medium', 'heavy', 'special', 'super', 'hurt', 'ko', 'win', 'intro'];

  var st = {
    inited: false, ctx: null, mx: null, unlocked: false, failed: !AC,
    vol: { master: 0.8, music: 0.6, sfx: 0.9 }, muted: false, paused: false,
    want: null, wantOpts: null, musicReady: false, cacheDone: false, timer: 0
  };
  A._st = st;

  function now() { return st.ctx ? st.ctx.currentTime : 0; }
  function live() { return !!(st.mx && st.ctx.state === 'running'); }
  function clamp01(v) { v = +v; return v > 1 ? 1 : v > 0 ? v : 0; }

  A.init = function () {
    if (st.inited) return;
    st.inited = true;
    var s = LC.settings || {};
    ['master', 'music', 'sfx'].forEach(function (k) { if (typeof s[k] === 'number') st.vol[k] = clamp01(s[k]); });
    var o = window.LC_OPTS || {};
    if (o.mute || /[?&]mute=1/.test(location.search || '')) st.muted = true;
    if (!AC) { console.warn('[audio] Web Audio unavailable: running silent'); return; }
    document.addEventListener('visibilitychange', onVisibility);
    ['pointerdown', 'mousedown', 'touchend', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, onGesture, true);
    });
  };

  function onGesture() {
    if (!st.ctx || st.ctx.state !== 'running') A.unlock();
  }
  function onVisibility() {
    if (!st.ctx) return;
    if (document.hidden) {
      if (st.ctx.state === 'running') st.ctx.suspend().catch(function () {});
    } else if (st.unlocked) resume();
  }
  function resume() {
    if (!st.ctx || st.ctx.state === 'running' || document.hidden) return;
    try {
      var p = st.ctx.resume();
      if (p && p.then) p.then(function () { startPending(); }, function () {});
    } catch (e) { /* will retry on next gesture */ }
  }

  A.unlock = function () {
    if (st.failed) return;
    if (!st.inited) A.init();
    if (!st.ctx) {
      try {
        try { st.ctx = new AC({ latencyHint: 'interactive' }); } catch (e1) { st.ctx = new AC(); }
      } catch (e) {
        st.failed = true;
        console.error('[audio] could not create AudioContext', e);
        return;
      }
      st.mx = new K.Mixer(st.ctx, effVol());
      if (st.paused) st.mx.setPaused(true, 0);
      st.mx.prepare().then(function () { st.musicReady = true; startPending(); },
        function (e) { console.error('[audio] drum kit render failed', e); st.mx.drums = {}; st.musicReady = true; startPending(); });
      // the SFX cache: UI first (menus come first), then fight sounds, then the rest
      var order = K.SFX_ORDER.slice().sort(function (a, b) { return cacheRank(a) - cacheRank(b); });
      setTimeout(function () { st.mx.buildCache(order, function () { st.cacheDone = true; }); }, 30);
      st.timer = setInterval(tick, TICK_MS);
    }
    resume();
    if (!st.unlocked) {
      st.unlocked = true;
      try {   // iOS: play one silent sample inside the gesture
        var b = st.ctx.createBuffer(1, 1, st.ctx.sampleRate), s = st.ctx.createBufferSource();
        s.buffer = b; s.connect(st.ctx.destination); s.start(0);
      } catch (e) { /* ignore */ }
    }
  };
  function cacheRank(n) {
    if (/^(ui\.|text\.)/.test(n)) return 0;
    if (/^(hit|block|whiff|jump|land|dash)\./.test(n) || /^(jump|land|dash|down)$/.test(n)) return 1;
    if (/^ann\./.test(n)) return 3;
    return 2;
  }
  function effVol() { return { master: st.muted ? 0 : st.vol.master, music: st.vol.music, sfx: st.vol.sfx }; }

  function tick() {
    if (!st.mx || st.ctx.state !== 'running') return;
    var t = st.ctx.currentTime;
    st.mx.tickMusic(t + LOOKAHEAD, t);
  }
  function startPending() {
    if (!st.musicReady || !st.mx || st.want === undefined) return;
    var w = st.want, o = st.wantOpts;
    st.want = undefined;
    st.mx.playTrack(w, now(), o);
    tick();
  }

  // ---- public API ----------------------------------------------------------------
  A.sfx = function (name, opts) {
    if (!K.SFX[name]) { K.warnOnce('sfx:' + name, 'unknown sfx "' + name + '"'); return; }
    if (!live()) return;
    st.mx.playSfx(name, now(), opts);
  };

  A.voice = function (charId, kind, opts) {
    if (!live() || !st.mx.playVoice) return;
    st.mx.playVoice(charId, kind, now(), opts);
  };

  A.music = function (track, opts) {
    if (track && !K.TRACKS[track]) { K.warnOnce('track:' + track, 'unknown music track "' + track + '"'); return; }
    if (!track) track = null;
    if (!st.mx || !st.musicReady) {           // locked: remember the latest request
      st.want = track; st.wantOpts = opts;
      return;
    }
    st.want = undefined;
    st.mx.playTrack(track, now(), opts);
    tick();
  };

  A.setVolume = function (kind, v) {
    if (!(kind in st.vol)) { K.warnOnce('vol:' + kind, 'unknown volume kind ' + kind); return; }
    st.vol[kind] = clamp01(v);
    if (st.mx) st.mx.setVol(kind, kind === 'master' && st.muted ? 0 : st.vol[kind], now());
  };
  A.getVolume = function (kind) { return st.vol[kind]; };

  A.duck = function (amount, seconds) { if (live()) st.mx.duck(amount, seconds, now()); };

  A.setPaused = function (on) {
    st.paused = !!on;
    if (st.mx) st.mx.setPaused(st.paused, now());
  };

  A.list = function () {
    return { sfx: K.SFX_ORDER.slice(), music: K.TRACK_ORDER.slice(), voice: { chars: ['claude', 'deepseek'], kinds: VOICE_KINDS.slice() } };
  };

  // ---- additions (documented in NOTES.md) -----------------------------------------
  A.setMuted = function (on) {
    st.muted = !!on;
    if (st.mx) st.mx.setVol('master', st.muted ? 0 : st.vol.master, now());
  };
  A.isMuted = function () { return st.muted; };
  A.isUnlocked = function () { return st.unlocked && live(); };
  A.state = function () { return st.failed ? 'unavailable' : !st.ctx ? 'locked' : st.ctx.state; };
  A.stopSfx = function () { if (st.mx) st.mx.stopAllSfx(now()); };
  A.currentTrack = function () {
    if (st.want !== undefined) return st.want;
    return st.mx && st.mx.cur && !st.mx.cur.stopping ? st.mx.cur.name : null;
  };
  A.position = function () { var c = st.mx && st.mx.cur; return c ? c.position(now()) : null; };
  A.VOICE_KINDS = VOICE_KINDS;
})();
