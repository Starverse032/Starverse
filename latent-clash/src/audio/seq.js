/* LATENT CLASH — tracker / sequencer (AUDIO module).
 *
 * Track data (see NOTES.md for the full format):
 *   K.defTrack(name, { bpm, spb: 4, bpb: 4, swing, vol, scale, order: [...], loop: 'A'|false,
 *                      ch: { name: { ins, vol, pan, echo, verb, lp, ...instrument params } },
 *                      sec: { A: { bars, chords, scale?, <ch>: line | generator | drum lanes } } })
 *   line   : 'D5:4 F#5:2 A5 | ...'  note[:steps][mods]  r=rest  _=tie  mods: ! accent, ' soft, ~ slide, ^ chromatic-ok
 *            chord-relative degrees for bass/arps: R (bass/slash note) T (true root) 2 3 4 5 6 7 8 9, A (approach
 *            to the next chord), octave shifts + / -.  Bars separated by |, every bar must sum to bpb*spb.
 *            A line shorter than the section repeats (its bar count must divide the section's).
 *   drums  : { k: 'x...x...', s: '....X...', t: '..1.2.3.' }   x normal  X accent  g ghost  digits = tom pitch
 *   gens   : { arp: [0,1,2,1], step: 2, len: 1, lo, hi }  { pad: 1, lo, hi, max }  { stab: 'x..x', lo, hi, len }
 * Compiled songs are flat sorted event lists; a TrackInst schedules them with look-ahead. */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var K = (LC.audio = LC.audio || {})._ = LC.audio._ || {};

  var KIT = { k: 'kick', s: 'snare', p: 'clap', h: 'hat', o: 'ohat', c: 'crash', r: 'ride', t: 'tom', w: 'rim', z: 'shaker', n: 'chipsn', b: 'boom' };
  var TOM_RATE = { 1: 1.6, 2: 1.32, 3: 1.08, 4: 0.86, 5: 0.7 };
  K.SONGS = {};

  // ---------------------------------------------------------------------------
  // Parsing
  // ---------------------------------------------------------------------------
  var RE_REST = /^(r|_)(?::(\d+))?$/;
  var RE_NOTE = /^([A-G](?:#|b)?-?\d)(?::(\d+))?([!'~^]*)$/;
  var RE_DEG = /^([RT2-9A])([+-]*)(?::(\d+))?([!'~^]*)$/;

  function splitBars(str) { return String(str).split('|').map(function (b) { return b.trim(); }); }

  // -> array of bars; each bar = [{ k: 'n'|'d'|'r'|'_', v, len, acc, soft, slide, chrom, at }]
  function parseLine(str, barSteps, err, where) {
    var bars = splitBars(str), out = [], dflt = barSteps / 4;
    bars.forEach(function (b, bi) {
      var toks = b.split(/\s+/).filter(Boolean), at = 0, bar = [];
      toks.forEach(function (tk) {
        var m, ev;
        if ((m = RE_REST.exec(tk))) ev = { k: m[1] === 'r' ? 'r' : '_', len: m[2] ? +m[2] : dflt };
        else if ((m = RE_NOTE.exec(tk))) ev = { k: 'n', v: K.midi(m[1]), len: m[2] ? +m[2] : dflt, mods: m[3] };
        else if ((m = RE_DEG.exec(tk))) ev = { k: 'd', v: m[1], sh: m[2], len: m[3] ? +m[3] : dflt, mods: m[4] };
        else { err.push(where + ' bar ' + (bi + 1) + ': bad token "' + tk + '"'); return; }
        if (!(ev.len > 0)) { err.push(where + ' bar ' + (bi + 1) + ': zero length "' + tk + '"'); return; }
        dflt = ev.len;
        var mods = ev.mods || '';
        ev.acc = mods.indexOf('!') >= 0; ev.soft = mods.indexOf("'") >= 0;
        ev.slide = mods.indexOf('~') >= 0; ev.chrom = mods.indexOf('^') >= 0;
        ev.at = at; at += ev.len;
        bar.push(ev);
      });
      if (at !== barSteps) err.push(where + ' bar ' + (bi + 1) + ': ' + at + ' steps, expected ' + barSteps + '  [' + b + ']');
      out.push(bar);
    });
    return out;
  }

  // Chord line -> per-step chord objects for the section.
  function parseChords(str, barSteps, bars, err, where) {
    var raw = splitBars(str), perBar = [];
    raw.forEach(function (b, bi) {
      var toks = b.split(/\s+/).filter(Boolean), list = [], at = 0;
      var hasDur = toks.some(function (t) { return t.indexOf(':') >= 0; });
      toks.forEach(function (tk) {
        var p = tk.split(':'), len = hasDur ? +p[1] : barSteps / toks.length, c;
        try { c = K.chord(p[0]); } catch (e) { err.push(where + ' bar ' + (bi + 1) + ': ' + e.message); c = K.chord('N'); }
        if (hasDur && !(len > 0)) err.push(where + ' bar ' + (bi + 1) + ': chord "' + tk + '" needs :steps');
        list.push({ c: c, at: at, len: len }); at += len;
      });
      if (Math.abs(at - barSteps) > 1e-9) err.push(where + ' chords bar ' + (bi + 1) + ': ' + at + ' steps, expected ' + barSteps);
      perBar.push(list);
    });
    if (bars % perBar.length) err.push(where + ' chords: ' + perBar.length + ' bars do not divide ' + bars);
    var steps = [];
    for (var b = 0; b < bars; b++) {
      var lst = perBar[b % perBar.length] || [];
      lst.forEach(function (x) { for (var s = 0; s < x.len; s++) steps[b * barSteps + x.at + s] = x.c; });
    }
    return steps;
  }

  function placeAbove(pc, ref) { var n = ref; while (((n % 12) + 12) % 12 !== pc) n++; return n; }

  // Resolve a chord degree token to midi.
  function resolveDeg(ev, chord, nextChord, lo) {
    if (!chord || chord.root < 0) return NaN;
    var bassN = placeAbove(chord.bass, lo), rootN = placeAbove(chord.root, lo), n;
    var iv = chord.iv;
    function has(x) { return iv.indexOf(x) >= 0; }
    switch (ev.v) {
      case 'R': n = bassN; break;
      case 'T': n = rootN; break;
      case '8': n = bassN + 12; break;
      case '2': case '9': n = rootN + (has(14) ? 14 : 2); if (ev.v === '2') n -= has(14) ? 12 : 0; break;
      case '3': n = rootN + (has(3) ? 3 : has(4) ? 4 : has(5) ? 5 : has(2) ? 2 : 4); break;
      case '4': n = rootN + 5; break;
      case '5': n = rootN + (has(7) ? 7 : has(6) ? 6 : has(8) ? 8 : 7); break;
      case '6': n = rootN + 9; break;
      case '7': n = rootN + (has(11) ? 11 : has(10) ? 10 : has(9) ? 9 : 10); break;
      case 'A': {
        var nc = nextChord && nextChord.root >= 0 ? nextChord : chord;
        var target = placeAbove(nc.bass, lo);
        if (target - bassN > 6) target -= 12;
        n = target - 1;
        break;
      }
    }
    if (n < bassN && ev.v !== 'A') n += 12;
    for (var i = 0; i < ev.sh.length; i++) n += ev.sh.charAt(i) === '+' ? 12 : -12;
    return n;
  }

  // ---------------------------------------------------------------------------
  // Compile
  // ---------------------------------------------------------------------------
  K.compile = function (name, force) {
    if (K.SONGS[name] && !force) return K.SONGS[name];
    var T = K.TRACKS[name];
    if (!T) return null;
    var err = [], warn = [];
    var spb = T.spb || 4, bpb = T.bpb || 4, barSteps = spb * bpb;
    var song = {
      name: name, bpm: T.bpm, spb: spb, bpb: bpb, barSteps: barSteps, stepDur: 60 / T.bpm / spb,
      swing: T.swing || 0, vol: T.vol == null ? 1 : T.vol, ch: T.ch, events: [], sections: [], errors: err, warnings: warn,
      echoTime: T.echo || (60 / T.bpm) * 0.75, echoFb: T.echoFb == null ? 0.32 : T.echoFb, score: []
    };
    var rnd = K.rng(T.seed || K.hash(name));
    var s0 = 0, loopAt = -1;
    var loopName = T.loop === undefined ? T.order[0] : T.loop;
    T.order.forEach(function (secName, oi) {
      var sec = T.sec[secName];
      if (!sec) { err.push('order[' + oi + ']: unknown section ' + secName); return; }
      if (loopName !== false && loopAt < 0 && (secName === loopName || oi === loopName)) loopAt = s0;
      var bars = sec.bars, where = name + '/' + secName;
      var chords = sec.chords ? parseChords(sec.chords, barSteps, bars, err, where + ' chords') : [];
      var scale = K.scale(sec.scale || T.scale || 'C chromatic');
      var info = { name: secName, s0: s0, bars: bars, chords: chords, scale: scale, notes: {} };
      song.sections.push(info);
      Object.keys(T.ch).forEach(function (cn) {
        var spec = sec[cn], cd = T.ch[cn];
        if (spec == null) return;
        var w = where + '.' + cn, list = info.notes[cn] = [];
        function push(step, m, len, vel, extra) {
          var e = { s: s0 + step, ch: cn, m: m, len: len, vel: vel * (1 + (rnd() - 0.5) * (cd.hum == null ? 0.08 : cd.hum)) };
          if (extra) for (var k in extra) e[k] = extra[k];
          song.events.push(e);
          list.push(e);
          return e;
        }
        var V = cd.vel || 0.8;
        if (cd.ins === 'drums') {
          Object.keys(spec).forEach(function (lane) {
            var str = spec[lane].replace(/[\s|]/g, ''), drum = (cd.kit && cd.kit[lane]) || KIT[lane];
            if (!drum || !K.DRUMS[drum]) { err.push(w + ': unknown drum lane ' + lane); return; }
            if (str.length % barSteps) { err.push(w + '.' + lane + ': ' + str.length + ' steps is not whole bars'); return; }
            var lb = str.length / barSteps;
            if (bars % lb) { err.push(w + '.' + lane + ': ' + lb + ' bars do not divide ' + bars); return; }
            var lv = (cd.lv && cd.lv[lane]) || 1;
            for (var st = 0; st < bars * barSteps; st++) {
              var ch = str.charAt(st % str.length);
              if (ch === '.' || ch === '-') continue;
              var vel = ch === 'X' ? 1 : ch === 'g' ? 0.4 : ch === 'x' ? 0.78 : 0.8;
              var rate = 1;
              if (/[1-5]/.test(ch)) rate = TOM_RATE[ch];
              else if (ch !== 'x' && ch !== 'X' && ch !== 'g') { err.push(w + '.' + lane + ': bad char ' + ch); continue; }
              push(st, -1, 1, vel * lv, { d: drum, rate: rate });
            }
          });
          return;
        }
        if (typeof spec === 'object') { genEvents(spec, cd, chords, bars, barSteps, push, w, err, V); return; }
        var lineBars = parseLine(spec, barSteps, err, w);
        if (bars % lineBars.length) { err.push(w + ': ' + lineBars.length + ' bars do not divide ' + bars); return; }
        var last = null, lo = cd.lo == null ? 36 : cd.lo;
        for (var b = 0; b < bars; b++) {
          lineBars[b % lineBars.length].forEach(function (ev) {
            var st = b * barSteps + ev.at;
            if (ev.k === 'r') { last = null; return; }
            if (ev.k === '_') { if (last) last.len += ev.len; else err.push(w + ' bar ' + (b + 1) + ': tie without note'); return; }
            var m = ev.v;
            if (ev.k === 'd') {
              var nx = null;
              for (var q = st + 1; q < bars * barSteps; q++) if (chords[q] && chords[q] !== chords[st]) { nx = chords[q]; break; }
              m = resolveDeg(ev, chords[st], nx, lo);
              if (isNaN(m)) { err.push(w + ' bar ' + (b + 1) + ': degree ' + ev.v + ' without chord'); return; }
            }
            var vel = V * (ev.acc ? 1.22 : ev.soft ? 0.6 : 1);
            last = push(st, m, ev.len, vel, { slide: ev.slide, chrom: ev.chrom });
          });
        }
      });
      s0 += bars * barSteps;
    });
    song.total = s0;
    song.loopStart = T.loop === false ? -1 : Math.max(0, loopAt);
    if (song.loopStart >= song.total) err.push('loop start beyond end');
    song.events.sort(function (a, b) { return a.s - b.s; });
    song.loopIdx = 0;
    while (song.loopIdx < song.events.length && song.events[song.loopIdx].s < song.loopStart) song.loopIdx++;
    song.duration = song.total * song.stepDur;
    song.loopDur = song.loopStart < 0 ? 0 : (song.total - song.loopStart) * song.stepDur;
    if (err.length) console.error('[audio] track ' + name + ' has ' + err.length + ' errors:\n  ' + err.join('\n  '));
    K.SONGS[name] = song;
    return song;
  };

  function genEvents(g, cd, chords, bars, barSteps, push, w, err, V) {
    var total = bars * barSteps, lo = g.lo || 60, hi = g.hi || 84, prev = null, vel = (g.vel || 1) * V;
    function voicing(c) { var v = K.voice(c, lo, hi, prev, g.max || 4); prev = v; return v; }
    if (g.pad) {
      var st = 0;
      while (st < total) {
        var c = chords[st];
        if (!c) { err.push(w + ': pad without chords'); return; }
        var en = st + 1;
        while (en < total && chords[en] === c && !(g.retrig && en % barSteps === 0)) en++;
        if (c.root >= 0) voicing(c).forEach(function (m) { push(st, m, en - st, vel); });
        st = en;
      }
      return;
    }
    if (g.arp) {
      var step = g.step || 1, len = g.len || step, cur = null, notes = null;
      for (var s = 0; s < total; s += step) {
        var ch = chords[s];
        if (!ch) { err.push(w + ': arp without chords'); return; }
        if (ch.root < 0) continue;
        if (ch !== cur) { cur = ch; var v = voicing(ch); notes = v.concat(v.map(function (x) { return x + 12; }), v.map(function (x) { return x + 24; })); }
        var idx = g.arp[((s % barSteps) / step) % g.arp.length];
        if (idx == null || idx < 0) continue;
        push(s, notes[idx % notes.length], len, vel * ((s % barSteps) === 0 ? 1.1 : 1));
      }
      return;
    }
    if (g.stab) {
      var pat = g.stab.replace(/[\s|]/g, '');
      if (pat.length % barSteps) { err.push(w + ': stab pattern not whole bars'); return; }
      for (var s2 = 0; s2 < total; s2++) {
        var cc = pat.charAt(s2 % pat.length);
        if (cc === '.') continue;
        var chd = chords[s2];
        if (!chd || chd.root < 0) continue;
        var vv = voicing(chd), vl = vel * (cc === 'X' ? 1.2 : 1);
        vv.forEach(function (m) { push(s2, m, g.len || 1, vl / Math.sqrt(vv.length)); });
      }
      return;
    }
    err.push(w + ': unknown generator');
  }

  // ---------------------------------------------------------------------------
  // Track instance: owns its channel nodes + echo, schedules events with look-ahead.
  // ---------------------------------------------------------------------------
  function TrackInst(mx, song, t0, fadeIn) {
    var ctx = mx.ctx;
    this.mx = mx; this.ctx = ctx; this.r = mx.r; this.song = song; this.name = song.name;
    this.t0 = t0; this.idx = 0; this.offset = 0; this.done = false; this.stopping = false; this.endT = Infinity;
    this.fade = ctx.createGain(); this.vfade = ctx.createGain();
    this.fade.connect(mx.musicIn); this.vfade.connect(mx.verbIn);
    if (fadeIn > 0) {
      this.fade.gain.setValueAtTime(0, t0); this.fade.gain.linearRampToValueAtTime(1, t0 + fadeIn);
      this.vfade.gain.setValueAtTime(0, t0); this.vfade.gain.linearRampToValueAtTime(1, t0 + fadeIn);
    }
    this.sum = ctx.createGain(); this.sum.gain.value = song.vol; this.sum.connect(this.fade);
    this.vsum = ctx.createGain(); this.vsum.gain.value = song.vol; this.vsum.connect(this.vfade);
    // ping-pong echo
    var e = this.echoIn = ctx.createGain();
    var dl = ctx.createDelay(1.5), dr = ctx.createDelay(1.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    var pl = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    var pr = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pl.pan) { pl.pan.value = -0.7; pr.pan.value = 0.7; }
    dl.delayTime.value = song.echoTime; dr.delayTime.value = song.echoTime;
    lp.type = 'lowpass'; lp.frequency.value = 3200; fb.gain.value = song.echoFb;
    e.connect(lp); lp.connect(dl); dl.connect(pl); pl.connect(this.sum); dl.connect(dr); dr.connect(pr); pr.connect(this.sum);
    dr.connect(fb); fb.connect(dl);
    this.chans = {};
    var self = this;
    Object.keys(song.ch).forEach(function (cn) {
      var d = song.ch[cn], inp = ctx.createGain(), node = inp;
      inp.gain.value = d.vol == null ? 0.5 : d.vol;
      if (d.lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = d.lp; f.Q.value = d.lq || 0.6; node.connect(f); node = f; }
      if (d.hp) { var h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = d.hp; h.Q.value = 0.6; node.connect(h); node = h; }
      if (d.pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = d.pan; node.connect(p); node = p; }
      node.connect(self.sum);
      if (d.echo) { var es = ctx.createGain(); es.gain.value = d.echo; node.connect(es); es.connect(self.echoIn); }
      if (d.verb) { var vs = ctx.createGain(); vs.gain.value = d.verb; node.connect(vs); vs.connect(self.vsum); }
      self.chans[cn] = { def: d, in: inp, lastF: 0 };
    });
  }
  K.TrackInst = TrackInst;

  TrackInst.prototype.timeOf = function (e, offset) {
    var sd = this.song.stepDur, t = this.t0 + (offset + e.s) * sd;
    if (this.song.swing && (e.s & 1)) t += this.song.swing * sd;
    return t;
  };

  // Schedule every event starting before `until`; events earlier than `now - 0.02` are dropped.
  TrackInst.prototype.schedule = function (until, now) {
    if (this.done || this.stopping) return;
    var song = this.song, ev = song.events, guard = 0;
    while (guard++ < 100000) {
      if (this.idx >= ev.length) {
        var endT = this.t0 + (this.offset + song.total) * song.stepDur;
        if (song.loopStart < 0) { this.done = true; this.endT = endT; return; }
        if (endT > until) return;
        this.offset += song.total - song.loopStart;
        this.idx = song.loopIdx;
        continue;
      }
      var e = ev[this.idx], t = this.timeOf(e, this.offset);
      if (t >= until) return;
      if (t >= now - 0.02) this.play(e, t);
      this.idx++;
    }
  };

  TrackInst.prototype.play = function (e, t) {
    var ch = this.chans[e.ch];
    if (!ch) return;
    var fn = K.INS[ch.def.ins];
    if (!fn) { K.warnOnce('ins:' + ch.def.ins, 'unknown instrument ' + ch.def.ins); return; }
    var dur = e.len * this.song.stepDur * (ch.def.gate == null ? 0.92 : ch.def.gate);
    try { fn(this, ch, t, e, dur); } catch (err) { K.warnOnce('play:' + this.name, 'note failed in ' + this.name + ': ' + err.message); }
  };

  // Song position (seconds into the loop structure) for a context time — for dev displays.
  TrackInst.prototype.position = function (t) {
    var s = (t - this.t0) / this.song.stepDur, song = this.song;
    if (s >= song.total && song.loopStart >= 0) s = song.loopStart + (s - song.loopStart) % (song.total - song.loopStart);
    var sec = null;
    for (var i = 0; i < song.sections.length; i++) if (s >= song.sections[i].s0) sec = song.sections[i];
    return { step: s, bar: Math.floor(s / song.barSteps) + 1, section: sec ? sec.name : '', seconds: s * song.stepDur };
  };

  TrackInst.prototype.stop = function (t, fade) {
    if (this.stopping) return;
    this.stopping = true;
    fade = Math.max(0.03, fade || 0);
    [this.fade.gain, this.vfade.gain].forEach(function (g) {
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
      g.linearRampToValueAtTime(0, t + fade);
    });
    this.endT = t + fade;
  };

  // Disconnect once silent. Returns true when the instance can be dropped.
  TrackInst.prototype.reap = function (now) {
    if (!(this.stopping || this.done) || now < this.endT + 3) return false;
    try { this.fade.disconnect(); this.vfade.disconnect(); } catch (e) { /* ignore */ }
    return true;
  };

  // ---------------------------------------------------------------------------
  // Mixer music API
  // ---------------------------------------------------------------------------
  K.Mixer.prototype.playTrack = function (name, t, opts) {
    opts = opts || {};
    var fade = opts.fade == null ? 0.5 : +opts.fade;
    if (this.cur && this.cur.name === name && !opts.restart && !this.cur.stopping && !this.cur.done) return this.cur;
    if (this.cur) this.cur.stop(t, fade);
    this.cur = null;
    if (!name) return null;
    var song = K.compile(name);
    if (!song) { K.warnOnce('track:' + name, 'unknown music track "' + name + '"'); return null; }
    var fadeIn = opts.fadeIn != null ? +opts.fadeIn : (this.tracks.length && fade > 0 ? Math.min(0.2, fade * 0.4) : 0);
    var ti = new TrackInst(this, song, t + 0.04, fadeIn);
    this.tracks.push(ti);
    this.cur = ti;
    return ti;
  };

  K.Mixer.prototype.tickMusic = function (until, now) {
    var tr = this.tracks;
    for (var i = tr.length - 1; i >= 0; i--) {
      tr[i].schedule(until, now);
      if (tr[i].reap(now)) { if (this.cur === tr[i]) this.cur = null; tr.splice(i, 1); }
    }
    if (this.cur && this.cur.done && now > this.cur.endT) this.cur = null;
  };

  // ---------------------------------------------------------------------------
  // Score printing + music-theory checks (dev tools)
  // ---------------------------------------------------------------------------
  K.analyzeSong = function (name, opts) {
    opts = opts || {};
    var song = K.compile(name, true), T = K.TRACKS[name], lines = [], issues = [];
    var melodyCh = opts.melody || Object.keys(T.ch).filter(function (c) { return T.ch[c].melody; });
    var bassCh = Object.keys(T.ch).filter(function (c) { return T.ch[c].bassline; });
    var bs = song.barSteps;
    lines.push('== ' + name + '  ' + T.bpm + ' BPM  ' + song.bpb + '/4  ' + (song.total / bs) + ' bars  ' +
      song.duration.toFixed(1) + ' s' + (song.loopStart >= 0 ? '  loop ' + song.loopDur.toFixed(1) + ' s from bar ' + (song.loopStart / bs + 1) : '  (one-shot)'));
    song.sections.forEach(function (sec) {
      lines.push('-- [' + sec.name + '] ' + sec.bars + ' bars, scale ' + sec.scale.label);
      for (var b = 0; b < sec.bars; b++) {
        var cs = [], lastc = null;
        for (var s = 0; s < bs; s++) { var c = sec.chords[b * bs + s]; if (c && c !== lastc) { cs.push(c.sym); lastc = c; } }
        var row = ('  ' + (b + 1)).slice(-3) + ' | ' + (cs.join(' ') + '            ').slice(0, 14);
        melodyCh.concat(bassCh).forEach(function (cn) {
          var ns = (sec.notes[cn] || []).filter(function (e) { return e.s >= sec.s0 + b * bs && e.s < sec.s0 + (b + 1) * bs; });
          row += ' | ' + cn + ': ' + ns.map(function (e) { return K.name(e.m) + (e.len !== 4 ? ':' + e.len : ''); }).join(' ');
        });
        lines.push(row);
      }
      // checks
      function chordAt(st) { return sec.chords[st - sec.s0]; }
      function soundingAt(list, st) { for (var i = list.length - 1; i >= 0; i--) if (list[i].s <= st && list[i].s + list[i].len > st) return list[i]; return null; }
      Object.keys(T.ch).forEach(function (cn) {
        var cd = T.ch[cn];
        if (cd.ins === 'drums' || cd.ins === 'riser') return;
        (sec.notes[cn] || []).forEach(function (e, i, arr) {
          if (e.m < 0) return;
          var pc = ((e.m % 12) + 12) % 12, bar = Math.floor((e.s - sec.s0) / bs) + 1;
          var c = chordAt(e.s), inChord = c && c.pcs.indexOf(pc) >= 0;
          if (!sec.scale.pcs[pc] && !e.chrom && !inChord) {
            var nx = arr[i + 1], pv = arr[i - 1];
            var passing = e.len <= 2 && ((nx && Math.abs(nx.m - e.m) <= 2) || (pv && Math.abs(pv.m - e.m) <= 2));
            issues.push((passing ? 'info ' : 'WARN ') + sec.name + ' bar ' + bar + ' ' + cn + ': ' + K.name(e.m) + ' out of scale' + (passing ? ' (passing)' : ''));
          }
        });
      });
      // strong-beat melody vs chord
      melodyCh.forEach(function (cn) {
        var list = sec.notes[cn] || [];
        for (var st = sec.s0; st < sec.s0 + sec.bars * bs; st += bs / 2) {
          var e = soundingAt(list, st), c = chordAt(st);
          if (!e || !c || c.root < 0 || e.chrom) continue;
          var iv = (((e.m - c.root) % 12) + 12) % 12, pc = ((e.m % 12) + 12) % 12;
          if (c.pcs.indexOf(pc) >= 0) continue;
          var clash = c.pcs.some(function (q) { return (((pc - q) % 12) + 12) % 12 === 1; });
          var bar = Math.floor((st - sec.s0) / bs) + 1, beat = (st - sec.s0) % bs ? 3 : 1;
          if (clash && e.s === st) issues.push('WARN ' + sec.name + ' bar ' + bar + ' beat ' + beat + ' ' + cn + ': ' + K.name(e.m) + ' clashes (b9) with ' + c.sym);
          else if (iv !== 2 && iv !== 9 && iv !== 5 && iv !== 6 && e.s === st && e.len >= 4) issues.push('info ' + sec.name + ' bar ' + bar + ' beat ' + beat + ' ' + cn + ': ' + K.name(e.m) + ' non-chord tone over ' + c.sym);
        }
      });
      // bass on downbeats / chord changes
      bassCh.forEach(function (cn) {
        var list = sec.notes[cn] || [];
        var lastC = null;
        for (var st = sec.s0; st < sec.s0 + sec.bars * bs; st++) {
          var c = chordAt(st);
          var isChange = c !== lastC; lastC = c;
          if (!c || c.root < 0 || !((st - sec.s0) % bs === 0 || isChange)) continue;
          var e = soundingAt(list, st);
          if (!e) continue;
          var pc = ((e.m % 12) + 12) % 12;
          if (pc !== c.bass && pc !== c.root) issues.push('WARN ' + sec.name + ' bar ' + (Math.floor((st - sec.s0) / bs) + 1) + ' ' + cn + ': ' + K.name(e.m) + ' is not the root/bass of ' + c.sym);
        }
      });
      // parallel clashes between melodic voices on onsets
      var mel = melodyCh.concat(Object.keys(T.ch).filter(function (c) { return T.ch[c].counter; }));
      for (var a = 0; a < mel.length; a++) for (var bb = a + 1; bb < mel.length; bb++) {
        var la = sec.notes[mel[a]] || [], lb = sec.notes[mel[bb]] || [];
        la.forEach(function (e) {
          var o = soundingAt(lb, e.s);
          if (!o || o.m < 0) return;
          var d = Math.abs(e.m - o.m) % 12;
          if ((d === 1 || d === 11) && (e.s - sec.s0) % (bs / 4) === 0) issues.push('WARN ' + sec.name + ' bar ' + (Math.floor((e.s - sec.s0) / bs) + 1) + ': ' + mel[a] + ' ' + K.name(e.m) + ' vs ' + mel[bb] + ' ' + K.name(o.m) + ' (m2/M7 on a beat)');
        });
      }
    });
    return { song: song, lines: lines, issues: issues, errors: song.errors };
  };
})();
