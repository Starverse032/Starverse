/* LATENT CLASH — audio core (AUDIO module).
 * Namespace, registries, music-theory helpers, seeded RNG.
 * Everything internal hangs off LC.audio._ (alias K); the public API is in engine.js.
 * No AudioContext is created here. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var A = LC.audio = LC.audio || {};
  var K = A._ = A._ || {};

  K.SFX = {};          // name -> def  { build(r, out, t, p, rnd), dur, vol, poly, guard, wet, tail, stereo, jitter, cat, desc, when }
  K.SFX_ORDER = [];
  K.TRACKS = {};       // name -> raw track def (compiled lazily by seq.js)
  K.TRACK_ORDER = [];
  K.INS = {};          // instrument name -> note function (instruments.js)
  K.DRUMS = {};        // drum name -> build function rendered to a buffer (instruments.js)

  K.warned = {};
  K.warnOnce = function (key, msg) {
    if (K.warned[key]) return;
    K.warned[key] = true;
    console.warn('[audio] ' + msg);
  };

  K.defSfx = function (name, def) {
    if (!def || typeof def.build !== 'function') { console.error('[audio] bad sfx def ' + name); return; }
    def.name = name;
    def.dur = def.dur || 0.3;
    def.vol = def.vol == null ? 1 : def.vol;
    def.poly = def.poly || 3;
    def.guard = def.guard == null ? 0.03 : def.guard;
    def.wet = def.wet || 0;
    def.tail = def.tail == null ? (def.wet ? 0.7 : 0.03) : def.tail;
    def.jitter = def.jitter || 0;
    def.prio = def.prio || 1;
    if (!K.SFX[name]) K.SFX_ORDER.push(name);
    K.SFX[name] = def;
  };

  K.defTrack = function (name, def) {
    def.name = name;
    if (!K.TRACKS[name]) K.TRACK_ORDER.push(name);
    K.TRACKS[name] = def;
  };

  // ---- RNG (mulberry32): audio has its own randomness, never the fight RNG ----
  K.rng = function (seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  K.rand = K.rng(0xC1A0DE);

  // ---- Notes ------------------------------------------------------------------
  var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  K.NOTE_NAMES = NAMES;

  K.pc = function (s) {             // 'F#' -> 6
    var b = PC[s.charAt(0)];
    if (b == null) return NaN;
    for (var i = 1; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '#') b++; else if (c === 'b') b--; else return NaN;
    }
    return (b + 12) % 12;
  };
  var NOTE_RE = /^([A-G])(#|b|##|bb)?(-?\d)$/;
  K.midi = function (s) {           // 'C4' -> 60
    var m = NOTE_RE.exec(s);
    if (!m) return NaN;
    var b = PC[m[1]], acc = m[2] || '';
    for (var i = 0; i < acc.length; i++) b += acc.charAt(i) === '#' ? 1 : -1;
    return b + 12 * (parseInt(m[3], 10) + 1);
  };
  K.mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  K.name = function (m) { return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); };
  K.pcName = function (p) { return NAMES[((p % 12) + 12) % 12]; };

  // ---- Scales -----------------------------------------------------------------
  K.SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], ionian: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
    hminor: [0, 2, 3, 5, 7, 8, 11], mminor: [0, 2, 3, 5, 7, 9, 11],
    pent: [0, 2, 4, 7, 9], mpent: [0, 3, 5, 7, 10], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };
  // 'D lydian', 'E minor +C# +D#'  ->  { root, pcs: bool[12], label }
  K.scale = function (str) {
    var parts = String(str).trim().split(/\s+/);
    var root = K.pc(parts[0]);
    var iv = K.SCALES[parts[1] || 'major'];
    if (isNaN(root) || !iv) throw new Error('bad scale "' + str + '"');
    var pcs = []; for (var i = 0; i < 12; i++) pcs.push(false);
    iv.forEach(function (x) { pcs[(root + x) % 12] = true; });
    for (var j = 2; j < parts.length; j++) {
      var p = parts[j];
      if (p.charAt(0) === '+') pcs[K.pc(p.slice(1))] = true;
    }
    return { root: root, pcs: pcs, label: str };
  };

  // ---- Chords -----------------------------------------------------------------
  var QUAL = {
    '': [0, 4, 7], 'm': [0, 3, 7], '5': [0, 7], 'dim': [0, 3, 6], 'aug': [0, 4, 8],
    '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'mmaj7': [0, 3, 7, 11],
    'm7b5': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9],
    'sus2': [0, 2, 7], 'sus4': [0, 5, 7], '7sus4': [0, 5, 7, 10], 'add9': [0, 4, 7, 14],
    'madd9': [0, 3, 7, 14], '9': [0, 4, 7, 10, 14], 'maj9': [0, 4, 7, 11, 14], 'm9': [0, 3, 7, 10, 14],
    '7b9': [0, 4, 7, 10, 13], 'aug7': [0, 4, 8, 10]
  };
  var CHORD_RE = /^([A-G](?:#|b)?)(maj9|maj7|mmaj7|m7b5|madd9|m9|m7|m6|dim7|dim|aug7|aug|7sus4|sus2|sus4|add9|7b9|m|6|7|9|5)?(?:\/([A-G](?:#|b)?))?$/;
  var chordCache = {};
  // 'A7/C#' -> { sym, root: 9, bass: 1, iv: [0,4,7,10], pcs: [9,1,4,7] }   'N' = no chord
  K.chord = function (sym) {
    if (chordCache[sym]) return chordCache[sym];
    var c;
    if (sym === 'N' || sym === '-') c = { sym: sym, root: -1, bass: -1, iv: [], pcs: [] };
    else {
      var m = CHORD_RE.exec(sym);
      if (!m) throw new Error('bad chord "' + sym + '"');
      var root = K.pc(m[1]), iv = QUAL[m[2] || ''];
      c = { sym: sym, root: root, bass: m[3] ? K.pc(m[3]) : root, iv: iv,
            pcs: iv.map(function (x) { return (root + x) % 12; }) };
    }
    chordCache[sym] = c;
    return c;
  };

  // Voice-led chord voicing: choose the inversion inside [lo, hi] (midi) closest to prev.
  K.voice = function (chord, lo, hi, prev, maxNotes) {
    var pcs = chord.iv.map(function (x) { return (chord.root + x) % 12; });
    var uniq = []; pcs.forEach(function (p) { if (uniq.indexOf(p) < 0) uniq.push(p); });
    if (maxNotes && uniq.length > maxNotes) {
      // drop the fifth first (least characteristic), keep root/3rd/7th/extensions
      var fifth = (chord.root + 7) % 12, k = uniq.indexOf(fifth);
      if (k > 0) uniq.splice(k, 1);
      while (uniq.length > maxNotes) uniq.splice(1, 1);
    }
    var best = null, bestCost = 1e9;
    for (var inv = 0; inv < uniq.length; inv++) {
      for (var base = lo - 12; base <= hi; base++) {
        if (((base % 12) + 12) % 12 !== uniq[inv]) continue;
        var notes = [base], cur = base;
        for (var j = 1; j < uniq.length; j++) {
          var pc = uniq[(inv + j) % uniq.length];
          var n = cur + 1; while (((n % 12) + 12) % 12 !== pc) n++;
          notes.push(n); cur = n;
        }
        if (notes[0] < lo || notes[notes.length - 1] > hi) continue;
        var cost = 0;
        if (prev && prev.length) {
          for (var q = 0; q < notes.length; q++) {
            var d = 1e9; for (var r = 0; r < prev.length; r++) d = Math.min(d, Math.abs(notes[q] - prev[r]));
            cost += d;
          }
        } else {
          cost = Math.abs((notes[0] + notes[notes.length - 1]) / 2 - (lo + hi) / 2);
        }
        if (cost < bestCost) { bestCost = cost; best = notes; }
      }
    }
    return best || pcs.map(function (p) { var n = lo; while (n % 12 !== p) n++; return n; });
  };

  // Helpers for writing track data in JS.
  K.rep = function (s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a.join(' | '); };
  K.bars = function () { return Array.prototype.slice.call(arguments).join(' | '); };
})();
